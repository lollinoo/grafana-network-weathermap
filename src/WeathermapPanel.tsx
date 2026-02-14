import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanelProps } from '@grafana/data';
import {
  Anchor,
  DrawnLink,
  DrawnNode,
  Link,
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
import { getArrowPolygon, getLinkValueFormatter, getMiddlePoint } from 'panel/linkMath';
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

  const [draggedNode, setDraggedNode] = useState(null as unknown as DrawnNode);
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
      draggedNode &&
      (draggedNode.index === d.index || selectedNodes.find((n) => n.index === d.index))
        ? nearestMultiple(d.x, wm.settings.panel.grid.size)
        : x;
    y =
      wm.settings.panel.grid.enabled &&
      draggedNode &&
      (draggedNode.index === d.index || selectedNodes.find((n) => n.index === d.index))
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

    toReturn.lineEndA = getMiddlePoint(
      toReturn.lineStartZ,
      toReturn.lineStartA,
      -toReturn.arrows.offset - toReturn.arrows.height
    );

    if (layoutNodes[toReturn.target.index].isConnection) {
      toReturn.lineEndA = toReturn.lineStartZ;
      toReturn.lineEndZ = toReturn.lineStartZ;
    }

    toReturn.arrowCenterA = getMiddlePoint(toReturn.lineStartZ, toReturn.lineStartA, -toReturn.arrows.offset);
    toReturn.arrowPolygonA = getArrowPolygon(
      toReturn.lineStartA,
      toReturn.arrowCenterA,
      toReturn.arrows.height,
      toReturn.arrows.width
    );

    toReturn.lineEndZ = getMiddlePoint(
      toReturn.lineStartZ,
      toReturn.lineStartA,
      toReturn.arrows.offset + toReturn.arrows.height
    );
    toReturn.arrowCenterZ = getMiddlePoint(toReturn.lineStartZ, toReturn.lineStartA, toReturn.arrows.offset);
    toReturn.arrowPolygonZ = getArrowPolygon(
      toReturn.lineStartZ,
      toReturn.arrowCenterZ,
      toReturn.arrows.height,
      toReturn.arrows.width
    );

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

  const [isDragging, setDragging] = useState(false);

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

  const handleNodeDrag = (nodeIndex: number, e: any, position: any) => {
    // Return early if we actually want to just pan the whole weathermap.
    if (e.ctrlKey) {
      return;
    }

    // Otherwise set our currently dragged node and manage scaling and grid settings.
    setDraggedNode(nodes[nodeIndex]);
    const scaledPos = getScaledMousePos({ x: position.deltaX, y: position.deltaY });
    setNodes((prevState) => applyNodeDrag(prevState, selectedNodes, nodeIndex, scaledPos));
  };

  const handleNodeStop = (nodeIndex: number) => {
    setDraggedNode(null as unknown as DrawnNode);
    const current = commitNodePositions(wm, nodes, nodeIndex, selectedNodes);
    onOptionsChange({
      ...options,
      weathermap: current,
    });
  };

  const handleNodeClick = (nodeIndex: number, e: any) => {
    const safeNodeDashboardLink = sanitizeExternalUrl(nodes[nodeIndex].dashboardLink, {
      allowRelative: true,
    });
    if (e.ctrlKey && isEditMode) {
      setSelectedNodes((selected) => toggleSelectedNode(selected, nodes[nodeIndex]));
    } else if (!isEditMode && safeNodeDashboardLink) {
      openSafeUrl(safeNodeDashboardLink);
    }
    // Force an update
    onOptionsChange(options);
  };

  const filteredGraphQueries = hoveredLink
    ? filterFramesByQueries(
        data.series,
        [hoveredLink.link.sides.A.query, hoveredLink.link.sides.Z.query],
        getDataFrameName,
        (error) => console.warn('Network Weathermap: Error while attempting to access query data.', error)
      )
    : [];

  if (wm) {
    const renderedLinkContexts = links.map((link) =>
      buildRenderLinkContext(link, links, nodes, (message) => console.warn(message))
    );

    const tooltipGraphFrames = hoveredLink
      ? decorateTooltipFrames(
          filteredGraphQueries,
          data.series,
          hoveredLink.link.sides.Z.query,
          wm.settings.tooltip.inboundColor,
          wm.settings.tooltip.outboundColor,
          getDataFrameName,
          (error) => console.warn('Network Weathermap: Error while attempting to access query data.', error)
        )
      : [];

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
            setDragging(true);
          }}
          onMouseMove={(e) => {
            if (isDragging && (e.ctrlKey || e.buttons === 4 || e.shiftKey)) {
              drag(e);
            }
          }}
          onMouseUp={() => {
            setDragging(false);
            onOptionsChange({ weathermap: commitPanelOffset(wm, offset) });
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
            />
            <NodeLayer
              nodes={nodes}
              draggedNode={draggedNode}
              selectedNodes={selectedNodes}
              weathermap={wm}
              isEditMode={isEditMode}
              data={data}
              onNodeDrag={handleNodeDrag}
              onNodeStop={handleNodeStop}
              onNodeClick={handleNodeClick}
            />
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
      </div>
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
