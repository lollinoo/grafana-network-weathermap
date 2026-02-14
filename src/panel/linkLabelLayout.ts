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
  // For waypointed links, position labels along the actual polyline path
  if (link.segments && link.segments.length > 1) {
    const allPoints: Position[] = [link.lineStartA];
    for (let i = 1; i < link.segments.length; i++) {
      allPoints.push(link.segments[i].start);
    }
    allPoints.push(link.lineStartZ);

    return getPointAlongPolyline(
      allPoints,
      side === 'A'
        ? 0.5 * (link.sides.A.labelOffset / 100)   // A label near source half
        : 1 - 0.5 * (link.sides.Z.labelOffset / 100) // Z label near target half
    );
  }

  // Original non-waypointed behavior
  if (side === 'A') {
    return getPercentPoint(
      link.lineStartZ,
      link.lineStartA,
      (nodes[link.target.index].isConnection ? 1 : 0.5) * (link.sides.A.labelOffset / 100)
    );
  }

  return getPercentPoint(link.lineStartA, link.lineStartZ, 0.5 * (link.sides.Z.labelOffset / 100));
}

/**
 * Find a point at a given fraction (0–1) along a polyline defined by ordered points.
 */
function getPointAlongPolyline(points: Position[], fraction: number): Position {
  if (points.length < 2) {
    return points[0] ?? { x: 0, y: 0 };
  }

  // Calculate total length
  let totalLength = 0;
  const segLengths: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    segLengths.push(len);
    totalLength += len;
  }

  if (totalLength === 0) {
    return points[0];
  }

  const targetDist = fraction * totalLength;
  let accumulated = 0;
  for (let i = 0; i < segLengths.length; i++) {
    if (accumulated + segLengths[i] >= targetDist) {
      const remaining = targetDist - accumulated;
      const t = remaining / segLengths[i];
      return {
        x: points[i].x + t * (points[i + 1].x - points[i].x),
        y: points[i].y + t * (points[i + 1].y - points[i].y),
      };
    }
    accumulated += segLengths[i];
  }

  return points[points.length - 1];
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
