import React, { useEffect, useState, useRef } from 'react';
import { Field, getTimeZone, PanelProps } from '@grafana/data';
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
import {
  LegendDisplayMode,
  stylesFactory,
  TimeSeries,
  TooltipDisplayMode,
  TooltipPlugin,
  useTheme2,
} from '@grafana/ui';
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
import MapNode from './components/MapNode';
import ColorScale from 'components/ColorScale';
import {
  getArrowPolygon,
  getLinkGraphFormatter,
  getLinkValueFormatter,
  getMiddlePoint,
  getPercentPoint,
} from 'panel/linkMath';
import { enrichHoveredLinkData } from 'panel/hoverLink';
import { applyNodeDrag, commitNodePositions, commitPanelOffset, toggleSelectedNode } from 'panel/nodeInteractions';
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

  // To be used to calculate how many links we've drawn
  let tempNodes = nodes.slice();

  const [links, setLinks] = useState(wm ? buildDrawnLinks(wm.links) : []);

  // Calculate aspect-ratio corrected drag positions
  function getScaledMousePos(pos: { x: number; y: number }): { x: number; y: number } {
    const zoomAmt = Math.pow(1.2, wm.settings.panel.zoomScale);
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
  function generateDrawnLink(d: Link, i: number): DrawnLink | null {
    let toReturn: DrawnLink = { ...d, sides: { A: { ...d.sides.A }, Z: { ...d.sides.Z } } } as DrawnLink;
    toReturn.index = i;

    const linkValueFormatter = getLinkValueFormatter(
      d.units ? d.units : wm.settings.link.defaultUnits ? wm.settings.link.defaultUnits : 'bps'
    );

    // Set the link's source and target node
    const source = nodes.find((n) => n.id === toReturn.nodes[0].id);
    const target = nodes.find((n) => n.id === toReturn.nodes[1].id);
    if (!source || !target) {
      console.warn(`Network Weathermap: Skipping link "${toReturn.id}" because one or both nodes are missing.`);
      return null;
    }
    toReturn.source = source;
    toReturn.target = target;

    let dataFrameWithIds: Array<{ value: number; id: string }> = [];
    data.series.forEach((frame) => {
      if (frame.fields.length < 2) {
        return;
      }
      try {
        dataFrameWithIds.push({
          value: frame.fields[1].values.get(frame.fields[1].values.length - 1),
          id: getDataFrameName(frame, data.series),
        });
      } catch (e) {
        console.warn('Network Weathermap: Error while attempting to access query data.', e);
      }
    });

    let filteredDataFramesWithIds = dataFrameWithIds.filter(
      (value) => value.id === toReturn.sides.A.query || value.id === toReturn.sides.Z.query
    );

    // For each of our A/Z sides
    for (let s = 0; s < 2; s++) {
      const side: 'A' | 'Z' = s === 0 ? 'A' : 'Z';

      // Check if we have a query to run for this side's bandwidth
      if (toReturn.sides[side].bandwidthQuery) {
        let dataFrame = dataFrameWithIds.filter((value) => value.id === toReturn.sides[side].bandwidthQuery);

        // Ensure we have the values we should
        if (dataFrame[0] !== undefined && dataFrame[0].value !== undefined) {
          // If we have a value, go use it
          toReturn.sides[side].bandwidth = dataFrame[0].value;
        } else {
          toReturn.sides[side].bandwidth = 0;
        }
      }

      // Set the display value to zero, just in case nothing exists
      toReturn.sides[side].currentValue = 0;
      toReturn.sides[side].currentText = 'n/a';
      toReturn.sides[side].currentValueText = 'n/a';
      toReturn.sides[side].currentPercentageText = 'n/a%';
      toReturn.sides[side].currentBandwidthText = 'n/a';

      // Check if we have a query to run for this side's throughput
      if (toReturn.sides[side].query) {
        let dataSource = toReturn.sides[side].query;
        let dataFrame = filteredDataFramesWithIds.filter((s) => s.id === dataSource);

        // Ensure we have the values we should
        if (dataFrame[0] !== undefined && dataFrame[0].value !== undefined) {
          // If we have a value, go use it
          toReturn.sides[side].currentValue = dataFrame[0].value;

          // Get the text formatted to KiB/MiB/etc.
          let scaledSideValue = linkValueFormatter(toReturn.sides[side].currentValue);
          toReturn.sides[side].currentValueText = `${scaledSideValue.text} ${scaledSideValue.suffix}`;

          // Get the percentage througput text
          // Note that this does allow the text to be 0% even when a query doesn't return a value.
          toReturn.sides[side].currentPercentageText =
            toReturn.sides[side].bandwidth > 0
              ? `${((toReturn.sides[side].currentValue / toReturn.sides[side].bandwidth) * 100).toFixed(2)}%`
              : 'n/a%';
        }
      }

      // Display throughput % when necessary
      if (toReturn.showThroughputPercentage || wm.settings.link.showAllWithPercentage) {
        toReturn.sides[side].currentText = toReturn.sides[side].currentPercentageText;
      } else {
        toReturn.sides[side].currentText = toReturn.sides[side].currentValueText;
      }

      let scaledBandwidth = linkValueFormatter(toReturn.sides[side].bandwidth);
      toReturn.sides[side].currentBandwidthText = `${scaledBandwidth.text} ${scaledBandwidth.suffix}`;
    }

    // Calculate positions for links and arrow polygons. Not included above to help with typing.
    toReturn.lineStartA = getMultiLinkPosition(tempNodes[toReturn.source.index], toReturn.sides.A);
    toReturn.lineStartZ = getMultiLinkPosition(tempNodes[toReturn.target.index], toReturn.sides.Z);

    toReturn.lineEndA = getMiddlePoint(
      toReturn.lineStartZ,
      toReturn.lineStartA,
      -toReturn.arrows.offset - toReturn.arrows.height
    );

    if (tempNodes[toReturn.target.index].isConnection) {
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

  function buildDrawnLinks(sourceLinks: Link[]): DrawnLink[] {
    tempNodes = tempNodes.map((n) => {
      n.anchors = {
        0: { numLinks: n.anchors[0].numLinks, numFilledLinks: 0 },
        1: { numLinks: n.anchors[1].numLinks, numFilledLinks: 0 },
        2: { numLinks: n.anchors[2].numLinks, numFilledLinks: 0 },
        3: { numLinks: n.anchors[3].numLinks, numFilledLinks: 0 },
        4: { numLinks: n.anchors[4].numLinks, numFilledLinks: 0 },
      };
      return n;
    });

    return sourceLinks.map((d, i) => generateDrawnLink(d, i)).filter((link): link is DrawnLink => link !== null);
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

  tempNodes = nodes.slice();

  // Update links on props/data change
  // TODO: Optimize this to only update the necessary links?
  useEffect(() => {
    setLinks(buildDrawnLinks(options.weathermap.links));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, data, nodes]); // need to keep nodes here for good looking updating

  const zoom = (e: WheelEvent) => {
    // Just don't allow zooming when not in edit mode
    if (!isEditMode && !e.shiftKey) {
      return;
    }

    let zoomed: Weathermap = wm;

    if (e.deltaY > 0) {
      zoomed.settings.panel.zoomScale += 1;
    } else {
      zoomed.settings.panel.zoomScale -= 1;
    }
    onOptionsChange({
      weathermap: zoomed,
    });
  };

  const [isDragging, setDragging] = useState(false);

  let aspectX = wm.settings.panel.panelSize.width / width2;
  let aspectY = wm.settings.panel.panelSize.height / height2;
  let aspectMultiplier = Math.max(aspectX, aspectY);

  const updateAspects = () => {
    aspectX = wm.settings.panel.panelSize.width / width2;
    aspectY = wm.settings.panel.panelSize.height / height2;
    aspectMultiplier = Math.max(aspectX, aspectY);
  };

  const [offset, setOffset] = useState(wm.settings.panel.offset);

  const drag = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (e.ctrlKey || e.buttons === 4 || e.shiftKey) {
      e.nativeEvent.preventDefault();
      const zoomAmt = Math.pow(1.2, wm.settings.panel.zoomScale);

      setOffset((prev) => {
        return {
          x: prev.x + e.nativeEvent.movementX * zoomAmt * aspectMultiplier,
          y: prev.y + e.nativeEvent.movementY * zoomAmt * aspectMultiplier,
        };
      });
    }
  };

  const [hoveredLink, setHoveredLink] = useState(null as unknown as HoveredLink);

  const handleLinkHover = (d: DrawnLink, side: 'A' | 'Z', e: any) => {
    if (e.shiftKey) {
      return;
    }

    const enrichedLink = enrichHoveredLinkData(d, links, tempNodes, (message) => console.warn(message));
    setHoveredLink({ link: enrichedLink, side, mouseEvent: e });
  };

  const handleLinkHoverLoss = (e: any) => {
    if (e.shiftKey) {
      return;
    }
    setHoveredLink(null as unknown as HoveredLink);
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
      buildRenderLinkContext(link, links, tempNodes, (message) => console.warn(message))
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
        {hoveredLink ? (
          <div
            className={css`
              position: absolute;
              top: ${hoveredLink.mouseEvent.nativeEvent.layerY}px;
              left: ${hoveredLink.mouseEvent.nativeEvent.layerX}px;
              transform: translate(0%, -100%);
              background-color: ${wm.settings.tooltip.backgroundColor};
              color: ${wm.settings.tooltip.textColor} !important;
              font-size: ${wm.settings.tooltip.fontSize} !important;
              z-index: 10000;
              display: ${hoveredLink ? 'flex' : 'none'};
              flex-direction: column;
              padding: ${wm.settings.tooltip.fontSize}px;
              border-radius: 4px;
              border: 1px solid
                ${getScaleColor(
                  hoveredLink.link.sides[hoveredLink.side].currentValue,
                  hoveredLink.link.sides[hoveredLink.side].bandwidth
                )};
            `}
          >
            <div
              style={{
                fontSize: wm.settings.tooltip.fontSize,
                borderBottom: `1px solid ${theme.colors.border.medium}`,
                marginBottom: '4px',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              {hoveredLink.link.nodes[0].label} {hoveredLink.side === 'A' ? '--->' : '<---'}{' '}
              {hoveredLink.link.nodes[1].label}
            </div>
            <div style={{ fontSize: wm.settings.tooltip.fontSize }}>
              Usage - Inbound: {hoveredLink.link.sides.Z.currentValueText}, Outbound:{' '}
              {hoveredLink.link.sides.A.currentValueText}
            </div>
            <div style={{ fontSize: wm.settings.tooltip.fontSize }}>
              Bandwidth - Inbound: {hoveredLink.link.sides.Z.currentBandwidthText}, Outbound:{' '}
              {hoveredLink.link.sides.A.currentBandwidthText}
            </div>
            <div style={{ fontSize: wm.settings.tooltip.fontSize }}>
              Throughput (%) - Inbound: {hoveredLink.link.sides.Z.currentPercentageText}, Outbound:{' '}
              {hoveredLink.link.sides.A.currentPercentageText}
            </div>
            <div style={{ fontSize: wm.settings.tooltip.fontSize, paddingBottom: '4px' }}>
              {safeHoveredLinkDashboardUrl ? 'Click to see more.' : ''}
            </div>
            {(hoveredLink.link.sides.A.query || hoveredLink.link.sides.Z.query) && filteredGraphQueries.length > 0 ? (
              <React.Fragment>
                <TimeSeries
                  width={250}
                  height={100}
                  timeRange={timeRange}
                  timeZone={getTimeZone()}
                  frames={tooltipGraphFrames}
                  legend={{
                    calcs: [],
                    displayMode: LegendDisplayMode.List,
                    placement: 'bottom',
                    isVisible: true,
                    showLegend: false,
                  }}
                  tweakScale={(opts, forField: Field<any>) => {
                    opts.softMin = 0;
                    if (
                      wm.settings.tooltip.scaleToBandwidth &&
                      hoveredLink.link.sides[hoveredLink.side].bandwidth > 0
                    ) {
                      opts.softMax = hoveredLink.link.sides[hoveredLink.side].bandwidth;
                    }
                    return opts;
                  }}
                  tweakAxis={(opts, forField: Field<any>) => {
                    opts.formatValue = getLinkGraphFormatter(
                      hoveredLink.link.units
                        ? hoveredLink.link.units
                        : wm.settings.link.defaultUnits
                        ? wm.settings.link.defaultUnits
                        : 'bps'
                    );
                    return opts;
                  }}
                >
                  {(config, alignedDataFrame) => {
                    return (
                      <>
                        <TooltipPlugin
                          config={config}
                          data={alignedDataFrame}
                          mode={TooltipDisplayMode.Multi}
                          timeZone={getTimeZone()}
                        />
                      </>
                    );
                  }}
                </TimeSeries>
                <div style={{ display: 'flex', alignItems: 'center', paddingTop: '10px' }}>
                  <div
                    style={{
                      width: '10px',
                      height: '3px',
                      background: wm.settings.tooltip.inboundColor,
                      paddingLeft: '5px',
                      marginRight: '4px',
                    }}
                  ></div>
                  <div style={{ fontSize: wm.settings.tooltip.fontSize }}>Inbound</div>
                  <div
                    style={{
                      width: '10px',
                      height: '3px',
                      background: wm.settings.tooltip.outboundColor,
                      marginLeft: '10px',
                      marginRight: '4px',
                    }}
                  ></div>
                  <div
                    style={{
                      fontSize: wm.settings.tooltip.fontSize,
                    }}
                  >
                    Outbound
                  </div>
                </div>
              </React.Fragment>
            ) : (
              ''
            )}
          </div>
        ) : (
          ''
        )}
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
          viewBox={`0 0 ${wm.settings.panel.panelSize.width * Math.pow(1.2, wm.settings.panel.zoomScale)} ${
            wm.settings.panel.panelSize.height * Math.pow(1.2, wm.settings.panel.zoomScale)
          }`}
          shapeRendering="crispEdges"
          textRendering="geometricPrecision"
          fontFamily="sans-serif"
          // @ts-ignore
          onWheel={zoom}
          onMouseDown={(e) => {
            e.preventDefault();
            updateAspects();
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
          <g
            transform={`translate(${
              (wm.settings.panel.panelSize.width * Math.pow(1.2, wm.settings.panel.zoomScale) -
                wm.settings.panel.panelSize.width) /
                2 +
              offset.x
            }, ${
              (wm.settings.panel.panelSize.height * Math.pow(1.2, wm.settings.panel.zoomScale) -
                wm.settings.panel.panelSize.height) /
                2 +
              offset.y
            })`}
            overflow="visible"
          >
            {wm.settings.panel.grid.guidesEnabled ? (
              <>
                <rect
                  x={
                    wm.nodes.length > 0
                      ? wm.nodes[0].position[0] -
                        wm.settings.panel.panelSize.width * Math.pow(1.2, wm.settings.panel.zoomScale) * 2
                      : 0
                  }
                  y={
                    wm.nodes.length > 0
                      ? wm.nodes[0].position[1] -
                        wm.settings.panel.panelSize.height * Math.pow(1.2, wm.settings.panel.zoomScale) * 2
                      : 0
                  }
                  width={wm.settings.panel.panelSize.width * Math.pow(1.2, wm.settings.panel.zoomScale) * 4}
                  height={wm.settings.panel.panelSize.height * Math.pow(1.2, wm.settings.panel.zoomScale) * 4}
                  fill="url(#smallGrid)"
                />
              </>
            ) : (
              ''
            )}
          </g>
          <g
            transform={`translate(${
              (wm.settings.panel.panelSize.width * Math.pow(1.2, wm.settings.panel.zoomScale) -
                wm.settings.panel.panelSize.width) /
                2 +
              offset.x
            }, ${
              (wm.settings.panel.panelSize.height * Math.pow(1.2, wm.settings.panel.zoomScale) -
                wm.settings.panel.panelSize.height) /
                2 +
              offset.y
            })`}
          >
            <g>
              {renderedLinkContexts.map(({ link: d, upstreamLinks }, i) => {
                if (d.nodes[0].id === d.nodes[1].id) {
                  return;
                }
                const safeADashboardLink = sanitizeExternalUrl(d.sides.A.dashboardLink, { allowRelative: true });
                const safeZDashboardLink = sanitizeExternalUrl(d.sides.Z.dashboardLink, { allowRelative: true });
                return (
                  <g
                    key={i}
                    className="line"
                    data-testid="link"
                    strokeOpacity={1}
                    width={Math.abs(d.target.x - d.source.x)}
                    height={Math.abs(d.target.y - d.source.y)}
                  >
                    <line
                      strokeWidth={d.stroke}
                      stroke={getScaleColor(d.sides.A.currentValue, d.sides.A.bandwidth)}
                      x1={d.lineStartA.x}
                      y1={d.lineStartA.y}
                      x2={d.lineEndA.x}
                      y2={d.lineEndA.y}
                      onMouseMove={(e) => {
                        handleLinkHover(d, 'A', e);
                      }}
                      onMouseOut={handleLinkHoverLoss}
                      onClick={() => {
                        if (safeADashboardLink) {
                          openSafeUrl(safeADashboardLink);
                        }
                      }}
                      style={safeADashboardLink ? { cursor: 'pointer' } : {}}
                    ></line>
                    {tempNodes[d.source.index].isConnection ? (
                      <circle
                        cx={d.lineStartA.x}
                        cy={d.lineStartA.y}
                        r={upstreamLinks.length > 0 ? Math.max(d.stroke, upstreamLinks[0].stroke) / 2 : d.stroke / 2}
                        fill={getScaleColor(d.sides.A.currentValue, d.sides.A.bandwidth)}
                        style={{ paintOrder: 'stroke' }}
                      ></circle>
                    ) : (
                      ''
                    )}
                    {tempNodes[d.target.index].isConnection ? (
                      ''
                    ) : (
                      <React.Fragment>
                        <polygon
                          points={`
                                        ${d.arrowCenterA.x}
                                        ${d.arrowCenterA.y}
                                        ${d.arrowPolygonA.p1.x}
                                        ${d.arrowPolygonA.p1.y}
                                        ${d.arrowPolygonA.p2.x}
                                        ${d.arrowPolygonA.p2.y}
                                    `}
                          fill={getScaleColor(d.sides.A.currentValue, d.sides.A.bandwidth)}
                          onMouseMove={(e) => {
                            handleLinkHover(d, 'A', e);
                          }}
                          onMouseOut={handleLinkHoverLoss}
                          onClick={() => {
                            if (safeADashboardLink) {
                              openSafeUrl(safeADashboardLink);
                            }
                          }}
                          style={safeADashboardLink ? { cursor: 'pointer' } : {}}
                        ></polygon>
                        <line
                          strokeWidth={d.stroke}
                          stroke={getScaleColor(d.sides.Z.currentValue, d.sides.Z.bandwidth)}
                          x1={d.lineStartZ.x}
                          y1={d.lineStartZ.y}
                          x2={d.lineEndZ.x}
                          y2={d.lineEndZ.y}
                          onMouseMove={(e) => {
                            handleLinkHover(d, 'Z', e);
                          }}
                          onMouseOut={handleLinkHoverLoss}
                          onClick={() => {
                            if (safeZDashboardLink) {
                              openSafeUrl(safeZDashboardLink);
                            }
                          }}
                          style={safeZDashboardLink ? { cursor: 'pointer' } : {}}
                        ></line>
                        <polygon
                          points={`
                                        ${d.arrowCenterZ.x}
                                        ${d.arrowCenterZ.y}
                                        ${d.arrowPolygonZ.p1.x}
                                        ${d.arrowPolygonZ.p1.y}
                                        ${d.arrowPolygonZ.p2.x}
                                        ${d.arrowPolygonZ.p2.y}
                                    `}
                          fill={getScaleColor(d.sides.Z.currentValue, d.sides.Z.bandwidth)}
                          onMouseMove={(e) => {
                            handleLinkHover(d, 'Z', e);
                          }}
                          onMouseOut={handleLinkHoverLoss}
                          onClick={() => {
                            if (safeZDashboardLink) {
                              openSafeUrl(safeZDashboardLink);
                            }
                          }}
                          style={safeZDashboardLink ? { cursor: 'pointer' } : {}}
                        ></polygon>
                      </React.Fragment>
                    )}
                  </g>
                );
              })}
            </g>
            <g>
              {renderedLinkContexts.map(({ link: d }, i) => {
                if (d.nodes[0].id === d.nodes[1].id) {
                  return;
                }
                const transform = getPercentPoint(
                  d.lineStartZ,
                  d.lineStartA,
                  (tempNodes[d.target.index].isConnection ? 1 : 0.5) * (d.sides.A.labelOffset / 100)
                );
                return (
                  <g
                    fontStyle={'italic'}
                    transform={`translate(${transform.x},${transform.y})`}
                    onMouseMove={(e) => {
                      handleLinkHover(d, 'A', e);
                    }}
                    onMouseOut={handleLinkHoverLoss}
                    key={i}
                  >
                    <rect
                      x={
                        -measureText(`${d.sides.A.currentText}`, wm.settings.fontSizing.link).width / 2 -
                        (wm.settings.fontSizing.link * 1.5) / 2
                      }
                      y={-wm.settings.fontSizing.link}
                      width={
                        measureText(`${d.sides.A.currentText}`, wm.settings.fontSizing.link).width +
                        wm.settings.fontSizing.link * 1.5
                      }
                      height={wm.settings.fontSizing.link * 2}
                      fill={getSolidFromAlphaColor(
                        wm.settings.link.label.background,
                        wm.settings.panel.backgroundColor
                      )}
                      stroke={getSolidFromAlphaColor(wm.settings.link.label.border, wm.settings.panel.backgroundColor)}
                      strokeWidth={2}
                      rx={(wm.settings.fontSizing.link + 8) / 2}
                    ></rect>
                    <text
                      x={0}
                      y={
                        measureText(`${d.sides.A.currentText}`, wm.settings.fontSizing.link).actualBoundingBoxAscent / 2
                      }
                      textAnchor={'middle'}
                      fontSize={`${wm.settings.fontSizing.link}px`}
                      fill={wm.settings.link.label.font}
                    >
                      {`${d.sides.A.currentText}`}
                    </text>
                  </g>
                );
              })}
            </g>
            <g>
              {renderedLinkContexts.map(({ link: d }, i) => {
                if (d.nodes[0].id === d.nodes[1].id || tempNodes[d.target.index].isConnection) {
                  return;
                }
                const transform = getPercentPoint(d.lineStartA, d.lineStartZ, 0.5 * (d.sides.Z.labelOffset / 100));
                return (
                  <g
                    fontStyle={'italic'}
                    transform={`translate(${transform.x},${transform.y})`}
                    onMouseMove={(e) => {
                      handleLinkHover(d, 'Z', e);
                    }}
                    onMouseOut={handleLinkHoverLoss}
                    key={i}
                  >
                    <rect
                      x={
                        -measureText(`${d.sides.Z.currentText}`, wm.settings.fontSizing.link).width / 2 -
                        (wm.settings.fontSizing.link * 1.5) / 2
                      }
                      y={-wm.settings.fontSizing.link}
                      width={
                        measureText(`${d.sides.Z.currentText}`, wm.settings.fontSizing.link).width +
                        wm.settings.fontSizing.link * 1.5
                      }
                      height={wm.settings.fontSizing.link * 2}
                      fill={getSolidFromAlphaColor(
                        wm.settings.link.label.background,
                        wm.settings.panel.backgroundColor
                      )}
                      stroke={getSolidFromAlphaColor(wm.settings.link.label.border, wm.settings.panel.backgroundColor)}
                      strokeWidth={2}
                      rx={(wm.settings.fontSizing.link + 8) / 2}
                    ></rect>
                    <text
                      x={0}
                      y={
                        measureText(`${d.sides.Z.currentText}`, wm.settings.fontSizing.link).actualBoundingBoxAscent / 2
                      }
                      textAnchor={'middle'}
                      fontSize={`${wm.settings.fontSizing.link}px`}
                      fill={wm.settings.link.label.font}
                    >
                      {`${d.sides.Z.currentText}`}
                    </text>
                  </g>
                );
              })}
            </g>
            <g>
              {nodes.map((d, i) => (
                <MapNode
                  key={d.id}
                  {...{
                    node: d,
                    draggedNode: draggedNode,
                    selectedNodes: selectedNodes,
                    wm: wm,
                    onDrag: (e, position) => {
                      // Return early if we actually want to just pan the whole weathermap.
                      if (e.ctrlKey) {
                        return;
                      }

                      // Otherwise set our currently dragged node and manage scaling and grid settings.
                      setDraggedNode(d);
                      const scaledPos = getScaledMousePos({ x: position.deltaX, y: position.deltaY });
                      setNodes((prevState) => applyNodeDrag(prevState, selectedNodes, i, scaledPos));
                      tempNodes = nodes.slice();
                      setLinks(buildDrawnLinks(wm.links));
                    },
                    onStop: (e, position) => {
                      // setDraggedNode(null as unknown as DrawnNode);
                      setDraggedNode(null as unknown as DrawnNode);
                      const current = commitNodePositions(wm, nodes, i, selectedNodes);
                      onOptionsChange({
                        ...options,
                        weathermap: current,
                      });
                    },
                    onClick: (e) => {
                      const safeNodeDashboardLink = sanitizeExternalUrl(tempNodes[i].dashboardLink, {
                        allowRelative: true,
                      });
                      if (e.ctrlKey && isEditMode) {
                        setSelectedNodes((selected) => toggleSelectedNode(selected, tempNodes[i]));
                      } else if (!isEditMode && safeNodeDashboardLink) {
                        openSafeUrl(safeNodeDashboardLink);
                      }
                      // Force an update
                      onOptionsChange(options);
                    },
                    disabled: !isEditMode,
                    data: data,
                  }}
                />
              ))}
            </g>
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
