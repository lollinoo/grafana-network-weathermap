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
export function getPointAlongPolyline(points: Position[], fraction: number): Position {
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

/**
 * Project a point onto a polyline and return the fraction (0–1) of the total path
 * length at the closest projected point. Used for draggable label positioning.
 */
export function getProjectionFractionOnPolyline(points: Position[], target: Position): number {
  if (points.length < 2) {
    return 0;
  }

  let totalLength = 0;
  const segLengths: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    segLengths.push(Math.sqrt(dx * dx + dy * dy));
    totalLength += segLengths[i];
  }

  if (totalLength === 0) {
    return 0;
  }

  // Find the closest point on any segment
  let bestDist = Infinity;
  let bestAccum = 0;
  let accumulated = 0;

  for (let i = 0; i < segLengths.length; i++) {
    const ax = points[i].x;
    const ay = points[i].y;
    const bx = points[i + 1].x;
    const by = points[i + 1].y;
    const segLen = segLengths[i];

    if (segLen === 0) {
      const dist = Math.sqrt((target.x - ax) ** 2 + (target.y - ay) ** 2);
      if (dist < bestDist) {
        bestDist = dist;
        bestAccum = accumulated;
      }
      continue;
    }

    // Project target onto the line segment [a, b], clamped to [0, 1]
    let t = ((target.x - ax) * (bx - ax) + (target.y - ay) * (by - ay)) / (segLen * segLen);
    t = Math.max(0, Math.min(1, t));

    const px = ax + t * (bx - ax);
    const py = ay + t * (by - ay);
    const dist = Math.sqrt((target.x - px) ** 2 + (target.y - py) ** 2);

    if (dist < bestDist) {
      bestDist = dist;
      bestAccum = accumulated + t * segLen;
    }

    accumulated += segLen;
  }

  return bestAccum / totalLength;
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
