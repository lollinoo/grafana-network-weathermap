import React from 'react';
import { DrawnLink, DrawnNode } from 'types';
import { RenderLinkContext } from 'panel/renderLink';
import {
  getLinkLabelMetrics,
  getLinkLabelTransform,
  LinkLabelSide,
  shouldRenderLinkLabel,
} from 'panel/linkLabelLayout';
import { getSolidFromAlphaColor } from 'utils';

interface LinkLabelsLayerProps {
  renderedLinkContexts: RenderLinkContext[];
  nodes: DrawnNode[];
  side: LinkLabelSide;
  fontSize: number;
  backgroundColor: string;
  borderColor: string;
  fontColor: string;
  panelBackgroundColor: string;
  onLinkHover: (link: DrawnLink, side: 'A' | 'Z', event: any) => void;
  onLinkHoverLoss: (event: any) => void;
  onLinkClick: (link: DrawnLink, side: 'A' | 'Z', event: React.MouseEvent<SVGGElement>) => void;
  isEditMode: boolean;
}

export const LinkLabelsLayer: React.FC<LinkLabelsLayerProps> = ({
  renderedLinkContexts,
  nodes,
  side,
  fontSize,
  backgroundColor,
  borderColor,
  fontColor,
  panelBackgroundColor,
  onLinkHover,
  onLinkHoverLoss,
  onLinkClick,
  isEditMode,
}) => {
  return (
    <g>
      {renderedLinkContexts.map(({ link: d }, i) => {
        if (!shouldRenderLinkLabel(d, side, nodes)) {
          return null;
        }

        const currentSide = d.sides[side];
        const text = `${currentSide.currentText}`;
        const transform = getLinkLabelTransform(d, side, nodes);
        const labelMetrics = getLinkLabelMetrics(text, fontSize);

        return (
          <g
            fontStyle={'italic'}
            transform={`translate(${transform.x},${transform.y})`}
            onMouseMove={(e) => {
              onLinkHover(d, side, e);
            }}
            onMouseOut={onLinkHoverLoss}
            onClick={(e) => onLinkClick(d, side, e)}
            style={isEditMode ? { cursor: 'pointer' } : {}}
            key={i}
          >
            <rect
              x={labelMetrics.rectX}
              y={-fontSize}
              width={labelMetrics.rectWidth}
              height={labelMetrics.rectHeight}
              fill={getSolidFromAlphaColor(backgroundColor, panelBackgroundColor)}
              stroke={getSolidFromAlphaColor(borderColor, panelBackgroundColor)}
              strokeWidth={2}
              rx={labelMetrics.rectRadius}
            ></rect>
            <text x={0} y={labelMetrics.textY} textAnchor={'middle'} fontSize={`${fontSize}px`} fill={fontColor}>
              {text}
            </text>
          </g>
        );
      })}
    </g>
  );
};
