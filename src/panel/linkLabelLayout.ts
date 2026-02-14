import { DrawnLink, DrawnNode, Position } from 'types';
import { measureText } from 'utils';
import { getPercentPoint } from './linkMath';

export type LinkLabelSide = 'A' | 'Z';

export interface LinkLabelMetrics {
  rectX: number;
  rectWidth: number;
  rectHeight: number;
  rectRadius: number;
  textY: number;
}

export function shouldRenderLinkLabel(link: DrawnLink, side: LinkLabelSide, nodes: DrawnNode[]): boolean {
  if (link.nodes[0].id === link.nodes[1].id) {
    return false;
  }

  if (side === 'Z' && nodes[link.target.index].isConnection) {
    return false;
  }

  return true;
}

export function getLinkLabelTransform(link: DrawnLink, side: LinkLabelSide, nodes: DrawnNode[]): Position {
  if (side === 'A') {
    return getPercentPoint(
      link.lineStartZ,
      link.lineStartA,
      (nodes[link.target.index].isConnection ? 1 : 0.5) * (link.sides.A.labelOffset / 100)
    );
  }

  return getPercentPoint(link.lineStartA, link.lineStartZ, 0.5 * (link.sides.Z.labelOffset / 100));
}

export function getLinkLabelMetrics(labelText: string, fontSize: number): LinkLabelMetrics {
  const measured = measureText(labelText, fontSize);
  return {
    rectX: -measured.width / 2 - (fontSize * 1.5) / 2,
    rectWidth: measured.width + fontSize * 1.5,
    rectHeight: fontSize * 2,
    rectRadius: (fontSize + 8) / 2,
    textY: measured.actualBoundingBoxAscent / 2,
  };
}
