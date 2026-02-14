import React from 'react';
import { DrawnLink, DrawnNode } from 'types';
import { RenderLinkContext } from 'panel/renderLink';
import { openSafeUrl, sanitizeExternalUrl } from 'utils';

interface LinkSegmentsLayerProps {
  renderedLinkContexts: RenderLinkContext[];
  nodes: DrawnNode[];
  getScaleColor: (current: number, max: number) => string;
  onLinkHover: (link: DrawnLink, side: 'A' | 'Z', event: any) => void;
  onLinkHoverLoss: (event: any) => void;
  onLinkClick: (link: DrawnLink, side: 'A' | 'Z', event: React.MouseEvent<SVGElement>) => void;
  isEditMode: boolean;
  selectedLinkId?: string;
  selectionColor: string;
}

export const LinkSegmentsLayer: React.FC<LinkSegmentsLayerProps> = ({
  renderedLinkContexts,
  nodes,
  getScaleColor,
  onLinkHover,
  onLinkHoverLoss,
  onLinkClick,
  isEditMode,
  selectedLinkId,
  selectionColor,
}) => {
  return (
    <g>
      {renderedLinkContexts.map(({ link: d, upstreamLinks }, i) => {
        if (d.nodes[0].id === d.nodes[1].id) {
          return null;
        }
        const safeADashboardLink = sanitizeExternalUrl(d.sides.A.dashboardLink, { allowRelative: true });
        const safeZDashboardLink = sanitizeExternalUrl(d.sides.Z.dashboardLink, { allowRelative: true });
        const isEditorSelected = selectedLinkId === d.id;

        const aSideColor = isEditorSelected ? selectionColor : getScaleColor(d.sides.A.currentValue, d.sides.A.bandwidth);
        const zSideColor = isEditorSelected ? selectionColor : getScaleColor(d.sides.Z.currentValue, d.sides.Z.bandwidth);

        return (
          <g
            key={i}
            className="line"
            data-testid="link"
            strokeOpacity={1}
            width={Math.abs(d.target.x - d.source.x)}
            height={Math.abs(d.target.y - d.source.y)}
          >
            {/* Render waypoint segments if present */}
            {d.segments && d.segments.length > 1 ? (
              <React.Fragment>
                {/* A-side polyline: source → all waypoints → arrow center (smooth joins) */}
                <polyline
                  strokeWidth={d.stroke}
                  stroke={aSideColor}
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={[
                    d.lineStartA,
                    ...d.segments.slice(1).map((seg) => seg.start),
                    nodes[d.target.index].isConnection ? d.lineStartZ : d.arrowCenterA,
                  ]
                    .map((p) => `${p.x},${p.y}`)
                    .join(' ')}
                  onMouseMove={(e) => onLinkHover(d, 'A', e)}
                  onMouseOut={onLinkHoverLoss}
                  onClick={(event) => {
                    onLinkClick(d, 'A', event);
                    if (!isEditMode && safeADashboardLink) {
                      openSafeUrl(safeADashboardLink);
                    }
                  }}
                  style={isEditMode || safeADashboardLink ? { cursor: 'pointer' } : {}}
                />
                {/* Arrows and Z-side line at the target end */}
                {nodes[d.target.index].isConnection ? '' : (
                  <React.Fragment>
                    <polygon
                      points={`${d.arrowCenterA.x} ${d.arrowCenterA.y} ${d.arrowPolygonA.p1.x} ${d.arrowPolygonA.p1.y} ${d.arrowPolygonA.p2.x} ${d.arrowPolygonA.p2.y}`}
                      fill={aSideColor}
                      onMouseMove={(e) => onLinkHover(d, 'A', e)}
                      onMouseOut={onLinkHoverLoss}
                      onClick={(event) => {
                        onLinkClick(d, 'A', event);
                        if (!isEditMode && safeADashboardLink) {
                          openSafeUrl(safeADashboardLink);
                        }
                      }}
                      style={isEditMode || safeADashboardLink ? { cursor: 'pointer' } : {}}
                    />
                    <line
                      strokeWidth={d.stroke}
                      stroke={zSideColor}
                      x1={d.lineStartZ.x}
                      y1={d.lineStartZ.y}
                      x2={d.lineEndZ.x}
                      y2={d.lineEndZ.y}
                      onMouseMove={(e) => onLinkHover(d, 'Z', e)}
                      onMouseOut={onLinkHoverLoss}
                      onClick={(event) => {
                        onLinkClick(d, 'Z', event);
                        if (!isEditMode && safeZDashboardLink) {
                          openSafeUrl(safeZDashboardLink);
                        }
                      }}
                      style={isEditMode || safeZDashboardLink ? { cursor: 'pointer' } : {}}
                    />
                    <polygon
                      points={`${d.arrowCenterZ.x} ${d.arrowCenterZ.y} ${d.arrowPolygonZ.p1.x} ${d.arrowPolygonZ.p1.y} ${d.arrowPolygonZ.p2.x} ${d.arrowPolygonZ.p2.y}`}
                      fill={zSideColor}
                      onMouseMove={(e) => onLinkHover(d, 'Z', e)}
                      onMouseOut={onLinkHoverLoss}
                      onClick={(event) => {
                        onLinkClick(d, 'Z', event);
                        if (!isEditMode && safeZDashboardLink) {
                          openSafeUrl(safeZDashboardLink);
                        }
                      }}
                      style={isEditMode || safeZDashboardLink ? { cursor: 'pointer' } : {}}
                    />
                  </React.Fragment>
                )}
              </React.Fragment>
            ) : (
              <React.Fragment>
                {/* Original non-waypointed rendering */}
                <line
                  strokeWidth={d.stroke}
                  stroke={aSideColor}
                  x1={d.lineStartA.x}
                  y1={d.lineStartA.y}
                  x2={d.lineEndA.x}
                  y2={d.lineEndA.y}
                  onMouseMove={(e) => onLinkHover(d, 'A', e)}
                  onMouseOut={onLinkHoverLoss}
                  onClick={(event) => {
                    onLinkClick(d, 'A', event);
                    if (!isEditMode && safeADashboardLink) {
                      openSafeUrl(safeADashboardLink);
                    }
                  }}
                  style={isEditMode || safeADashboardLink ? { cursor: 'pointer' } : {}}
                ></line>
                {nodes[d.source.index].isConnection ? (
                  <circle
                    cx={d.lineStartA.x}
                    cy={d.lineStartA.y}
                    r={upstreamLinks.length > 0 ? Math.max(d.stroke, upstreamLinks[0].stroke) / 2 : d.stroke / 2}
                    fill={aSideColor}
                    style={{ paintOrder: 'stroke' }}
                  ></circle>
                ) : (
                  ''
                )}
                {nodes[d.target.index].isConnection ? (
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
                      fill={aSideColor}
                      onMouseMove={(e) => {
                        onLinkHover(d, 'A', e);
                      }}
                      onMouseOut={onLinkHoverLoss}
                      onClick={(event) => {
                        onLinkClick(d, 'A', event);
                        if (!isEditMode && safeADashboardLink) {
                          openSafeUrl(safeADashboardLink);
                        }
                      }}
                      style={isEditMode || safeADashboardLink ? { cursor: 'pointer' } : {}}
                    ></polygon>
                    <line
                      strokeWidth={d.stroke}
                      stroke={zSideColor}
                      x1={d.lineStartZ.x}
                      y1={d.lineStartZ.y}
                      x2={d.lineEndZ.x}
                      y2={d.lineEndZ.y}
                      onMouseMove={(e) => {
                        onLinkHover(d, 'Z', e);
                      }}
                      onMouseOut={onLinkHoverLoss}
                      onClick={(event) => {
                        onLinkClick(d, 'Z', event);
                        if (!isEditMode && safeZDashboardLink) {
                          openSafeUrl(safeZDashboardLink);
                        }
                      }}
                      style={isEditMode || safeZDashboardLink ? { cursor: 'pointer' } : {}}
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
                      fill={zSideColor}
                      onMouseMove={(e) => {
                        onLinkHover(d, 'Z', e);
                      }}
                      onMouseOut={onLinkHoverLoss}
                      onClick={(event) => {
                        onLinkClick(d, 'Z', event);
                        if (!isEditMode && safeZDashboardLink) {
                          openSafeUrl(safeZDashboardLink);
                        }
                      }}
                      style={isEditMode || safeZDashboardLink ? { cursor: 'pointer' } : {}}
                    ></polygon>
                  </React.Fragment>
                )}
              </React.Fragment>
            )}
          </g>
        );
      })}
    </g>
  );
};
