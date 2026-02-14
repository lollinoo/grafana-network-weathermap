import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanelProps } from '@grafana/data';
import {
  Anchor,
  DrawnLink,
  DrawnNode,
  Link,
  LinkSegment,
  LinkSide,
  Node,
  SimpleOptions,
  Position,
  Weathermap,
  HoveredLink,
  Threshold,
} from 'types';
import { css, cx } from 'emotion';
import { stylesFactory, useTheme2 } from '@grafana/ui';
import {
  measureText,
  getSolidFromAlphaColor,
  nearestMultiple,
  calculateRectangleAutoWidth,
  calculateRectangleAutoHeight,
  CURRENT_VERSION,
  handleVersionedStateUpdates,
  getDataFrameName,
  openSafeUrl,
  sanitizeExternalUrl,
} from 'utils';
import { LinkLabelsLayer } from 'components/LinkLabelsLayer';
import { LinkSegmentsLayer } from 'components/LinkSegmentsLayer';
import { NodeLayer } from 'components/NodeLayer';
import ColorScale from 'components/ColorScale';
import { LinkTooltip } from 'components/LinkTooltip';
import { getLinkValueFormatter, getMiddlePoint } from './panel/linkMath';
import { getProjectionFractionOnPolyline } from 'panel/linkLabelLayout';
import { enrichHoveredLinkData } from 'panel/hoverLink';
import { buildDrawnLinkSidesWithMetrics, collectSeriesValuesByFrameId, SeriesValueById } from 'panel/linkMetrics';
import { applyNodeDrag, commitNodePositions, commitPanelOffset, toggleSelectedNode } from 'panel/nodeInteractions';
import { getGridGuideRect, getPanelTranslateOffset, getZoomedPanelSize } from 'panel/panelCanvas';
import { applyPanOffset, applyZoomDelta, getZoomFactor, shouldAllowZoom } from 'panel/panelViewport';
import { buildRenderLinkContext } from 'panel/renderLink';
import { decorateTooltipFrames, filterFramesByQueries } from 'panel/tooltipFrames';

// Calculate node position, width, etc.
function generateDrawnNode(d: Node, i: number, wm: Weathermap): DrawnNode {
  let toReturn: DrawnNode = { ...d } as DrawnNode;
  toReturn.index = i;
  toReturn.x = toReturn.position[0];
  toReturn.y = toReturn.position[1];
  toReturn.labelWidth = measureText(d.label ? d.label : '', wm.settings.fontSizing.node).width;
  toReturn.anchors = {
    0: { numLinks: toReturn.anchors[0].numLinks, numFilledLinks: 0 },
    1: { numLinks: toReturn.anchors[1].numLinks, numFilledLinks: 0 },
    2: { numLinks: toReturn.anchors[2].numLinks, numFilledLinks: 0 },
    3: { numLinks: toReturn.anchors[3].numLinks, numFilledLinks: 0 },
    4: { numLinks: toReturn.anchors[4].numLinks, numFilledLinks: 0 },
  };
  return toReturn;
}

/**
 * Weathermap panel component.
 */
export const WeathermapPanel: React.FC<PanelProps<SimpleOptions>> = (props: PanelProps<SimpleOptions>) => {
  const { options, data, width: width2, height: height2, onOptionsChange, timeRange } = props;
  const styles = getStyles();
  const theme = useTheme2();
  const wm = options.weathermap;

  if (wm && (!wm.version || wm.version !== CURRENT_VERSION)) {
    onOptionsChange({ weathermap: handleVersionedStateUpdates(wm, theme) });
  }

  // Check for editing-related feature set
  const isEditMode = window.location.search.includes('editPanel');

  const [selectedNodes, setSelectedNodes] = useState([] as DrawnNode[]);

  function getScaleColor(current: number, max: number) {
    if (max === 0) {
      return getSolidFromAlphaColor(wm.settings.link.stroke.color, wm.settings.panel.backgroundColor);
    }

    const percent = (current / max) * 100;
    let assignedColor = '';

    wm.scale.forEach((threshold: Threshold) => {
      if (threshold.percent <= percent) {
        assignedColor = threshold.color;
      }
    });

    return assignedColor;
  }

  const [nodes, setNodes] = useState(
    wm.nodes.map((d, i) => {
      return generateDrawnNode(d, i, wm);
    })
  );

  const seriesValues = useMemo(
    () =>
      collectSeriesValuesByFrameId(data.series, getDataFrameName, (error) =>
        console.warn('Network Weathermap: Error while attempting to access query data.', error)
      ),
    [data.series]
  );

  const [links, setLinks] = useState(wm ? buildDrawnLinks(wm.links) : []);

  // Calculate aspect-ratio corrected drag positions
  function getScaledMousePos(pos: { x: number; y: number }): { x: number; y: number } {
    const zoomAmt = getZoomFactor(wm.settings.panel.zoomScale);
    return {
      x: pos.x * zoomAmt * aspectMultiplier,
      y: pos.y * zoomAmt * aspectMultiplier,
    };
  }

  // Calculate the position of a link given the node and side information
  function getMultiLinkPosition(d: DrawnNode, side: LinkSide): Position {
    // Set initial x and y values for links. Defaults to center x of the node, and the middle y.
    let x = d.x;
    let y = d.y;

    // Set x and y to the rounded value if we are using the grid
    x =
      wm.settings.panel.grid.enabled &&
        (selectedNodes.find((n) => n.index === d.index))
        ? nearestMultiple(d.x, wm.settings.panel.grid.size)
        : x;
    y =
      wm.settings.panel.grid.enabled &&
        (selectedNodes.find((n) => n.index === d.index))
        ? nearestMultiple(d.y, wm.settings.panel.grid.size)
        : y;

    // The maximum link width on this anchor point
    const maxLinkWidth = Math.max(
      ...wm.links
        .filter((l) => l.nodes[0].id === d.id || l.nodes[1].id === d.id)
        .filter((l) => side.anchor === l.sides.A.anchor || l.sides.Z.anchor === side.anchor)
        .map((l) => l.stroke)
    );

    // Change x values for left/right anchors
    if (side.anchor === Anchor.Left || side.anchor === Anchor.Right) {
      // Align left/right
      if (side.anchor === Anchor.Left) {
        x -= calculateRectangleAutoWidth(d, wm) / 2 - maxLinkWidth / 2;
      } else {
        x += calculateRectangleAutoWidth(d, wm) / 2 - maxLinkWidth / 2;
      }
      // Calculate vertical alignments given # of links
      if (!d.compactVerticalLinks && d.anchors[side.anchor].numLinks > 1) {
        const linkHeight = maxLinkWidth + wm.settings.link.spacing.vertical;
        const fullHeight =
          linkHeight * d.anchors[side.anchor].numLinks - wm.settings.link.spacing.vertical - maxLinkWidth;
        y -= fullHeight / 2;
        y +=
          (d.anchors[side.anchor].numFilledLinks + 1) * maxLinkWidth +
          d.anchors[side.anchor].numFilledLinks * wm.settings.link.spacing.vertical -
          maxLinkWidth;
      }
    } else if (side.anchor !== Anchor.Center) {
      if (d.useConstantSpacing) {
        // To be used with constant-spacing
        const maxWidth =
          maxLinkWidth * (d.anchors[side.anchor].numLinks - 1) +
          wm.settings.link.spacing.horizontal * (d.anchors[side.anchor].numLinks - 1);
        x +=
          -maxWidth / 2 + d.anchors[side.anchor].numFilledLinks * (maxLinkWidth + wm.settings.link.spacing.horizontal);
      } else {
        // To be used with auto-spacing
        const paddedWidth = d.labelWidth + d.padding.horizontal * 2;
        x +=
          -paddedWidth / 2 +
          (d.anchors[side.anchor].numFilledLinks + 1) *
          (paddedWidth / (nodes[d.index].anchors[side.anchor].numLinks + 1));
      }
      // Add height if we are at the bottom;
      if (side.anchor === Anchor.Bottom) {
        y += calculateRectangleAutoHeight(d, wm) / 2 - maxLinkWidth / 2;
      } else if (side.anchor === Anchor.Top) {
        y -= calculateRectangleAutoHeight(d, wm) / 2;
        y += maxLinkWidth / 2;
      }
    }
    // Mark that we've drawn another link
    d.anchors[side.anchor].numFilledLinks++;
    return { x, y };
  }

  // Calculate link positions / text / colors / etc.
  function generateDrawnLink(
    d: Link,
    i: number,
    layoutNodes: DrawnNode[],
    valuesBySeries: SeriesValueById[]
  ): DrawnLink | null {
    let toReturn: DrawnLink = { ...d, sides: { A: { ...d.sides.A }, Z: { ...d.sides.Z } } } as DrawnLink;
    toReturn.index = i;

    const linkValueFormatter = getLinkValueFormatter(
      d.units ? d.units : wm.settings.link.defaultUnits ? wm.settings.link.defaultUnits : 'bps'
    );

    // Set the link's source and target node
    const source = layoutNodes.find((n) => n.id === toReturn.nodes[0].id);
    const target = layoutNodes.find((n) => n.id === toReturn.nodes[1].id);
    if (!source || !target) {
      console.warn(`Network Weathermap: Skipping link "${toReturn.id}" because one or both nodes are missing.`);
      return null;
    }
    toReturn.source = source;
    toReturn.target = target;

    toReturn.sides = buildDrawnLinkSidesWithMetrics(
      toReturn,
      valuesBySeries,
      wm.settings.link.showAllWithPercentage,
      linkValueFormatter
    );

    // Calculate positions for links and arrow polygons. Not included above to help with typing.
    toReturn.lineStartA = getMultiLinkPosition(layoutNodes[toReturn.source.index], toReturn.sides.A);
    toReturn.lineStartZ = getMultiLinkPosition(layoutNodes[toReturn.target.index], toReturn.sides.Z);

    // Build waypoint segments if this link has waypoints
    if (d.waypoints && d.waypoints.length > 0) {
      const allPoints = [toReturn.lineStartA, ...d.waypoints, toReturn.lineStartZ];
      const segments: LinkSegment[] = [];
      for (let s = 0; s < allPoints.length - 1; s++) {
        segments.push({ start: allPoints[s], end: allPoints[s + 1] });
      }
      toReturn.segments = segments;

      // Compute end points - for waypointed links, we draw the A-side line all the way to Z
      toReturn.lineEndA = toReturn.lineStartZ;
      toReturn.lineEndZ = toReturn.lineStartZ;
    } else {
      // Original non-waypointed behavior - split at middle
      toReturn.lineEndA = getMiddlePoint(
        toReturn.lineStartZ,
        toReturn.lineStartA,
        0
      );

      if (layoutNodes[toReturn.target.index].isConnection) {
        toReturn.lineEndA = toReturn.lineStartZ;
        toReturn.lineEndZ = toReturn.lineStartZ;
      } else {
        toReturn.lineEndZ = getMiddlePoint(
          toReturn.lineStartZ,
          toReturn.lineStartA,
          0
        );
      }
    }

    return toReturn;
  }

  function buildDrawnLinks(
    sourceLinks: Link[],
    sourceNodes: DrawnNode[] = nodes,
    valuesBySeries: SeriesValueById[] = seriesValues
  ): DrawnLink[] {
    const layoutNodes = sourceNodes.map((node) => ({
      ...node,
      anchors: {
        0: { numLinks: node.anchors[0].numLinks, numFilledLinks: 0 },
        1: { numLinks: node.anchors[1].numLinks, numFilledLinks: 0 },
        2: { numLinks: node.anchors[2].numLinks, numFilledLinks: 0 },
        3: { numLinks: node.anchors[3].numLinks, numFilledLinks: 0 },
        4: { numLinks: node.anchors[4].numLinks, numFilledLinks: 0 },
      },
    }));

    return sourceLinks
      .map((link, index) => generateDrawnLink(link, index, layoutNodes, valuesBySeries))
      .filter((link): link is DrawnLink => link !== null);
  }

  // Minimize uneeded state changes
  const mounted = useRef(false);

  // Update nodes on props/data change
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
    } else {
      setNodes(
        options.weathermap.nodes.map((d, i) => {
          return generateDrawnNode(d, i, options.weathermap);
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, data]);

  // Update links on props/data change
  // TODO: Optimize this to only update the necessary links?
  useEffect(() => {
    setLinks(buildDrawnLinks(options.weathermap.links));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, data, nodes]); // need to keep nodes here for good looking updating

  const zoom = (e: WheelEvent) => {
    if (!shouldAllowZoom(isEditMode, e.shiftKey)) {
      return;
    }

    onOptionsChange({
      weathermap: applyZoomDelta(wm, e.deltaY),
    });
  };

  /* 
   * Drag state handling
   * We use a ref instead of state to avoid re-render race conditions that were causing
   * the onClick handler to believe we were still dragging after mouseUp.
   */
  const dragRef = useRef({ isMouseDown: false, hasMoved: false });
  const waypointDragRef = useRef<{ linkIdx: number; linkId: string; wpIdx: number; hasMoved: boolean } | null>(null);
  const labelDragRef = useRef<{ linkId: string; linkIdx: number; side: 'A' | 'Z'; hasMoved: boolean } | null>(null);
  // Track active drag for visual feedback (triggers re-render for border color change)
  const [activeDrag, setActiveDrag] = useState<'waypoint' | 'label' | null>(null);

  /**
   * Convert client (screen) mouse coordinates to the SVG world coordinate space
   * used by nodes, waypoints, and labels (i.e. inside the <g translate> group).
   */
  function clientToWorldCoords(clientX: number, clientY: number, svgEl: SVGSVGElement): Position | null {
    const ctm = svgEl.getScreenCTM();
    if (!ctm) {
      return null;
    }
    const pt = svgEl.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgPt = pt.matrixTransform(ctm.inverse());
    // Subtract the <g translate> offset to get into world coordinate space
    return {
      x: svgPt.x - panelTranslateOffset.x,
      y: svgPt.y - panelTranslateOffset.y,
    };
  }

  // Remove the old isDragging state
  // const [isDragging, setDragging] = useState(false);

  const aspectX = wm.settings.panel.panelSize.width / width2;
  const aspectY = wm.settings.panel.panelSize.height / height2;
  const aspectMultiplier = Math.max(aspectX, aspectY);

  const [offset, setOffset] = useState(wm.settings.panel.offset);
  const zoomedPanelSize = getZoomedPanelSize(wm.settings.panel.panelSize, wm.settings.panel.zoomScale);
  const panelTranslateOffset = getPanelTranslateOffset(
    wm.settings.panel.panelSize,
    wm.settings.panel.zoomScale,
    offset
  );
  const gridGuideRect = getGridGuideRect(
    wm.nodes[0]?.position,
    wm.settings.panel.panelSize,
    wm.settings.panel.zoomScale
  );

  const drag = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (e.ctrlKey || e.buttons === 4 || e.shiftKey) {
      e.nativeEvent.preventDefault();

      setOffset((prev) => {
        return applyPanOffset(
          prev,
          e.nativeEvent.movementX,
          e.nativeEvent.movementY,
          wm.settings.panel.zoomScale,
          aspectMultiplier
        );
      });
    }
  };

  const [hoveredLink, setHoveredLink] = useState(null as unknown as HoveredLink);

  const selectEditorEntity = (type: 'node' | 'link', id: string, waypointIdx?: number) => {
    if (!isEditMode) {
      return;
    }

    const previous = wm.editorSelection;
    // If clicking the same entity with the same waypoint, do nothing
    if (
      previous?.selectedType === type &&
      ((type === 'node' && previous.selectedNodeId === id) || (type === 'link' && previous.selectedLinkId === id)) &&
      previous.selectedWaypointIdx === waypointIdx
    ) {
      return;
    }

    onOptionsChange({
      weathermap: {
        ...wm,
        editorSelection: {
          ...previous,
          selectedType: type,
          selectedNodeId: type === 'node' ? id : previous?.selectedNodeId,
          selectedLinkId: type === 'link' ? id : previous?.selectedLinkId,
          selectedWaypointIdx: waypointIdx,
        },
      },
    });
  };

  const handleLinkHover = (d: DrawnLink, side: 'A' | 'Z', e: any) => {
    if (e.shiftKey) {
      return;
    }

    const enrichedLink = enrichHoveredLinkData(d, links, nodes, (message) => console.warn(message));
    setHoveredLink({ link: enrichedLink, side, mouseEvent: e });
  };

  const handleLinkHoverLoss = (e: any) => {
    if (e.shiftKey) {
      return;
    }
    setHoveredLink(null as unknown as HoveredLink);
  };

  const handleLinkClick = (link: DrawnLink, _side: 'A' | 'Z', e: any) => {
    e.stopPropagation();
    selectEditorEntity('link', link.id);
  };

  const handleLabelDragStart = (link: DrawnLink, side: 'A' | 'Z', _e: React.MouseEvent<SVGGElement>) => {
    // Only start drag if this link is already selected (click-first-then-drag UX)
    const isAlreadySelected = wm.editorSelection?.selectedType === 'link' && wm.editorSelection?.selectedLinkId === link.id;
    if (!isAlreadySelected) {
      // First click: just select the link — don't start drag
      selectEditorEntity('link', link.id);
      return;
    }
    const linkIdx = wm.links.findIndex((l) => l.id === link.id);
    if (linkIdx >= 0) {
      labelDragRef.current = { linkId: link.id, linkIdx, side, hasMoved: false };
    }
  };

  const handleNodeDrag = (nodeIndex: number, e: any, position: any) => {
    // Return early if we actually want to just pan the whole weathermap.
    if (e.ctrlKey) {
      return;
    }

    // Otherwise set our currently dragged node and manage scaling and grid settings.
    const scaledPos = getScaledMousePos({ x: position.deltaX, y: position.deltaY });
    setNodes((prevState) => applyNodeDrag(prevState, selectedNodes, nodeIndex, scaledPos));
  };

  const handleNodeStop = (nodeIndex: number) => {
    const current = commitNodePositions(wm, nodes, nodeIndex, selectedNodes);
    onOptionsChange({
      ...options,
      weathermap: current,
    });
  };

  const handleNodeClick = (nodeIndex: number, e: any) => {
    e.stopPropagation();
    const safeNodeDashboardLink = sanitizeExternalUrl(nodes[nodeIndex].dashboardLink, {
      allowRelative: true,
    });
    if (isEditMode) {
      selectEditorEntity('node', nodes[nodeIndex].id);
    }
    if (e.ctrlKey && isEditMode) {
      setSelectedNodes((selected) => toggleSelectedNode(selected, nodes[nodeIndex]));
    } else if (!isEditMode && safeNodeDashboardLink) {
      openSafeUrl(safeNodeDashboardLink);
    }
  };

  const filteredGraphQueries = useMemo(
    () =>
      hoveredLink
        ? filterFramesByQueries(
          data.series,
          [hoveredLink.link.sides.A.query, hoveredLink.link.sides.Z.query],
          getDataFrameName,
          (error) => console.warn('Network Weathermap: Error while attempting to access query data.', error)
        )
        : [],
    [data.series, hoveredLink]
  );

  const renderedLinkContexts = useMemo(
    () => links.map((link) => buildRenderLinkContext(link, links, nodes, (message) => console.warn(message))),
    [links, nodes]
  );

  const tooltipGraphFrames = useMemo(
    () =>
      hoveredLink
        ? decorateTooltipFrames(
          filteredGraphQueries,
          data.series,
          hoveredLink.link.sides.Z.query,
          wm.settings.tooltip.inboundColor,
          wm.settings.tooltip.outboundColor,
          getDataFrameName,
          (error) => console.warn('Network Weathermap: Error while attempting to access query data.', error)
        )
        : [],
    [
      data.series,
      filteredGraphQueries,
      hoveredLink,
      wm.settings.tooltip.inboundColor,
      wm.settings.tooltip.outboundColor,
    ]
  );

  if (wm) {
    const safeBackgroundImageUrl = sanitizeExternalUrl(wm.settings.panel.backgroundImage?.url, {
      allowRelative: true,
      allowDataImage: true,
    });
    const safeHoveredLinkDashboardUrl = hoveredLink
      ? sanitizeExternalUrl(hoveredLink.link.sides[hoveredLink.side].dashboardLink, { allowRelative: true })
      : undefined;

    return (
      <div
        className={cx(
          styles.wrapper,
          css`
            width: ${width2}px;
            height: ${height2}px;
            position: relative;
          `
        )}
      >
        <LinkTooltip
          hoveredLink={hoveredLink}
          weathermap={wm}
          filteredGraphQueries={filteredGraphQueries}
          tooltipGraphFrames={tooltipGraphFrames}
          timeRange={timeRange}
          safeDashboardUrl={safeHoveredLinkDashboardUrl}
          borderColor={theme.colors.border.medium}
          getScaleColor={getScaleColor}
        />
        <ColorScale thresholds={wm.scale} settings={wm.settings} />
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            backgroundImage: wm.settings.panel.backgroundImage
              ? safeBackgroundImageUrl
                ? `url(${safeBackgroundImageUrl})`
                : 'none'
              : 'none',
            backgroundSize: wm.settings.panel.backgroundImage?.fit,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundColor: wm.settings.panel.backgroundImage ? 'none' : wm.settings.panel.backgroundColor,
          }}
          id={`nw-${wm.id}${isEditMode ? '_' : ''}`}
          width={width2}
          height={height2}
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox={`0 0 ${zoomedPanelSize.width} ${zoomedPanelSize.height}`}
          shapeRendering="crispEdges"
          textRendering="geometricPrecision"
          fontFamily="sans-serif"
          // @ts-ignore
          onWheel={zoom}
          onMouseDown={(e) => {
            e.preventDefault();
            dragRef.current.isMouseDown = true;
            dragRef.current.hasMoved = false;
          }}
          onMouseMove={(e) => {
            const svgEl = (e.currentTarget as unknown) as SVGSVGElement;

            // Handle waypoint dragging (absolute positioning via getScreenCTM)
            if (waypointDragRef.current) {
              e.preventDefault();
              const ref = waypointDragRef.current;
              const worldPos = clientToWorldCoords(e.clientX, e.clientY, svgEl);
              if (!worldPos) {
                return;
              }
              if (!ref.hasMoved) {
                ref.hasMoved = true;
                setActiveDrag('waypoint');
              }
              const currentWm = { ...wm };
              if (currentWm.links[ref.linkIdx]?.waypoints?.[ref.wpIdx]) {
                currentWm.links[ref.linkIdx].waypoints![ref.wpIdx] = {
                  x: Math.round(worldPos.x),
                  y: Math.round(worldPos.y),
                };
                onOptionsChange({ weathermap: currentWm });
              }
              return;
            }

            // Handle label dragging along link path
            if (labelDragRef.current) {
              e.preventDefault();
              const ref = labelDragRef.current;
              if (!ref.hasMoved) {
                ref.hasMoved = true;
                setActiveDrag('label');
              }
              const drawnLink = links.find((l) => l.id === ref.linkId);
              if (!drawnLink) {
                return;
              }

              const worldPos = clientToWorldCoords(e.clientX, e.clientY, svgEl);
              if (!worldPos) {
                return;
              }

              // Build polyline points
              let polyPoints: Position[];
              if (drawnLink.segments && drawnLink.segments.length > 1) {
                polyPoints = [drawnLink.lineStartA];
                for (let si = 1; si < drawnLink.segments.length; si++) {
                  polyPoints.push(drawnLink.segments[si].start);
                }
                polyPoints.push(drawnLink.lineStartZ);
              } else {
                polyPoints = [drawnLink.lineStartA, drawnLink.lineStartZ];
              }

              // Project mouse onto polyline and get fraction
              const fraction = getProjectionFractionOnPolyline(polyPoints, worldPos);

              // Convert fraction to labelOffset percentage
              // A-side: fraction maps to first half (0–0.5) → offset = fraction * 2 * 100
              // Z-side: fraction maps to second half (0.5–1) → offset = (1 - fraction) * 2 * 100
              let newOffset: number;
              if (ref.side === 'A') {
                newOffset = Math.max(1, Math.min(100, Math.round(fraction * 2 * 100)));
              } else {
                newOffset = Math.max(1, Math.min(100, Math.round((1 - fraction) * 2 * 100)));
              }

              // Immutable update so React detects the change in the form
              const currentWm = { ...wm, links: [...wm.links] };
              const updatedLink = { ...currentWm.links[ref.linkIdx] };
              updatedLink.sides = {
                ...updatedLink.sides,
                [ref.side]: { ...updatedLink.sides[ref.side], labelOffset: newOffset },
              };
              currentWm.links[ref.linkIdx] = updatedLink;
              onOptionsChange({ weathermap: currentWm });
              return;
            }

            if (dragRef.current.isMouseDown) {
              dragRef.current.hasMoved = true;
              if (e.ctrlKey || e.buttons === 4 || e.shiftKey) {
                drag(e);
              }
            }
          }}
          onMouseUp={() => {
            // Complete waypoint interaction (click or drag)
            if (waypointDragRef.current) {
              const ref = waypointDragRef.current;
              if (!ref.hasMoved) {
                // Pure click: select the waypoint
                selectEditorEntity('link', ref.linkId, ref.wpIdx);
              }
              waypointDragRef.current = null;
              setActiveDrag(null);
              return;
            }
            // Complete label drag
            if (labelDragRef.current) {
              labelDragRef.current = null;
              setActiveDrag(null);
              return;
            }
            dragRef.current.isMouseDown = false;
            // Only commit offset if we moved
            if (dragRef.current.hasMoved) {
              onOptionsChange({ weathermap: commitPanelOffset(wm, offset) });
            }
          }}
          onClick={(e) => {
            // Only clear selection if we didn't drag
            if (!dragRef.current.hasMoved) {
              if (isEditMode) {
                const previous = wm.editorSelection;
                if (previous?.selectedType) {
                  onOptionsChange({
                    weathermap: {
                      ...wm,
                      editorSelection: {
                        ...previous,
                        selectedType: undefined,
                        selectedNodeId: undefined,
                        selectedLinkId: undefined,
                      },
                    },
                  });
                }
                setSelectedNodes([]);
              }
            }
          }}
          onDoubleClick={() => {
            setSelectedNodes([]);
          }}
        >
          {wm.settings.panel.grid.enabled ? (
            <defs>
              <pattern
                id="smallGrid"
                width={wm.settings.panel.grid.size}
                height={wm.settings.panel.grid.size}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${wm.settings.panel.grid.size} 0 L 0 0 0 ${wm.settings.panel.grid.size}`}
                  fill="none"
                  stroke="gray"
                  strokeWidth="2"
                  opacity={1}
                />
              </pattern>
            </defs>
          ) : (
            ''
          )}
          <g transform={`translate(${panelTranslateOffset.x}, ${panelTranslateOffset.y})`} overflow="visible">
            {wm.settings.panel.grid.guidesEnabled ? (
              <>
                <rect
                  x={gridGuideRect.x}
                  y={gridGuideRect.y}
                  width={gridGuideRect.width}
                  height={gridGuideRect.height}
                  fill="url(#smallGrid)"
                />
              </>
            ) : (
              ''
            )}
          </g>
          <g transform={`translate(${panelTranslateOffset.x}, ${panelTranslateOffset.y})`}>
            <LinkSegmentsLayer
              renderedLinkContexts={renderedLinkContexts}
              nodes={nodes}
              getScaleColor={getScaleColor}
              onLinkHover={handleLinkHover}
              onLinkHoverLoss={handleLinkHoverLoss}
              onLinkClick={handleLinkClick}
              isEditMode={isEditMode}
              selectedLinkId={wm.editorSelection?.selectedType === 'link' ? wm.editorSelection.selectedLinkId : undefined}
              selectionColor={theme.colors.primary.main}
            />
            <LinkLabelsLayer
              renderedLinkContexts={renderedLinkContexts}
              nodes={nodes}
              side="A"
              fontSize={wm.settings.fontSizing.link}
              backgroundColor={wm.settings.link.label.background}
              borderColor={wm.settings.link.label.border}
              fontColor={wm.settings.link.label.font}
              panelBackgroundColor={wm.settings.panel.backgroundColor}
              onLinkHover={handleLinkHover}
              onLinkHoverLoss={handleLinkHoverLoss}
              onLinkClick={handleLinkClick}
              onLabelDragStart={handleLabelDragStart}
              isEditMode={isEditMode}
              selectedLinkId={wm.editorSelection?.selectedType === 'link' ? wm.editorSelection.selectedLinkId : undefined}
              draggingLabelSide={activeDrag === 'label' && labelDragRef.current ? labelDragRef.current.side : undefined}
              draggingLinkId={activeDrag === 'label' && labelDragRef.current ? labelDragRef.current.linkId : undefined}
              selectionColor={theme.colors.primary.main}
            />
            <LinkLabelsLayer
              renderedLinkContexts={renderedLinkContexts}
              nodes={nodes}
              side="Z"
              fontSize={wm.settings.fontSizing.link}
              backgroundColor={wm.settings.link.label.background}
              borderColor={wm.settings.link.label.border}
              fontColor={wm.settings.link.label.font}
              panelBackgroundColor={wm.settings.panel.backgroundColor}
              onLinkHover={handleLinkHover}
              onLinkHoverLoss={handleLinkHoverLoss}
              onLinkClick={handleLinkClick}
              onLabelDragStart={handleLabelDragStart}
              isEditMode={isEditMode}
              selectedLinkId={wm.editorSelection?.selectedType === 'link' ? wm.editorSelection.selectedLinkId : undefined}
              draggingLabelSide={activeDrag === 'label' && labelDragRef.current ? labelDragRef.current.side : undefined}
              draggingLinkId={activeDrag === 'label' && labelDragRef.current ? labelDragRef.current.linkId : undefined}
              selectionColor={theme.colors.primary.main}
            />
            <NodeLayer
              nodes={nodes}
              draggedNode={null as unknown as DrawnNode}
              selectedNodes={selectedNodes}
              selectedNodeId={wm.editorSelection?.selectedType === 'node' ? wm.editorSelection.selectedNodeId : undefined}
              weathermap={wm}
              isEditMode={isEditMode}
              data={data}
              onNodeDrag={handleNodeDrag}
              onNodeStop={handleNodeStop}
              onNodeClick={handleNodeClick}
            />
            {/* Waypoint drag handles */}
            {isEditMode && wm.links.map((link, linkIdx) => {
              if (!link.waypoints || link.waypoints.length === 0) {
                return null;
              }
              const isLinkSelected = wm.editorSelection?.selectedType === 'link' && wm.editorSelection?.selectedLinkId === link.id;
              return link.waypoints.map((wp, wpIdx) => {
                const isWpSelected = isLinkSelected && wm.editorSelection?.selectedWaypointIdx === wpIdx;
                const isBeingDragged = activeDrag === 'waypoint' && waypointDragRef.current?.linkIdx === linkIdx && waypointDragRef.current?.wpIdx === wpIdx;
                return (
                  <React.Fragment key={`wp-${linkIdx}-${wpIdx}`}>
                    {/* Large invisible hit area for reliable click/drag at all zoom levels */}
                    <circle
                      cx={wp.x}
                      cy={wp.y}
                      r={16}
                      fill="transparent"
                      stroke="none"
                      pointerEvents="all"
                      style={{ cursor: isLinkSelected ? 'grab' : 'pointer' }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (!isLinkSelected) {
                          // First click: select the link + specific waypoint
                          selectEditorEntity('link', link.id, wpIdx);
                          return;
                        }
                        // Link already selected: prepare for drag (visual feedback on first move)
                        waypointDragRef.current = { linkIdx, linkId: link.id, wpIdx, hasMoved: false };
                      }}
                      onClick={(e) => {
                        // Prevent SVG onClick from clearing the selection we just set
                        e.stopPropagation();
                      }}
                    />
                    {/* Visible waypoint indicator */}
                    <circle
                      cx={wp.x}
                      cy={wp.y}
                      r={isWpSelected ? 8 : isLinkSelected ? 6 : 4}
                      fill={isWpSelected ? theme.colors.primary.main : isLinkSelected ? theme.colors.primary.shade : theme.colors.text.secondary}
                      stroke={
                        isBeingDragged ? theme.colors.warning.main
                          : isWpSelected ? theme.colors.primary.contrastText
                            : isLinkSelected ? theme.colors.primary.border
                              : 'transparent'
                      }
                      strokeWidth={isBeingDragged ? 4 : isWpSelected ? 3 : 2}
                      opacity={isLinkSelected ? 0.9 : 0.4}
                      pointerEvents="none"
                    />
                  </React.Fragment>
                );
              });
            })}
          </g>
        </svg>
        <div
          className={cx(
            styles.timeText,
            css`
              color: ${theme.colors.getContrastText(
              wm.settings.panel.backgroundColor.startsWith('image')
                ? wm.settings.panel.backgroundColor.split('|', 3)[1]
                : wm.settings.panel.backgroundColor
            )};
            `
          )}
        >
          {wm.settings.panel.showTimestamp ? timeRange.to.toLocaleString() : ''}
        </div>
      </div >
    );
  } else {
    return <React.Fragment />;
  }
};

const getStyles = stylesFactory(() => {
  return {
    wrapper: css`
      position: relative;
      font-size: 10px;
      font-family: sans-serif;
    `,
    textBox: css`
      position: absolute;
      bottom: 0;
      left: 0;
      padding: 10px;
    `,
    nodeText: css`
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      -khtml-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      -o-user-select: none;
      user-select: none;
    `,
    timeText: css`
      position: absolute;
      bottom: 0;
      right: 0;
      color: black;
      padding: 5px 10px;
      font-size: 12px;
    `,
  };
});
