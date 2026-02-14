import { getValueFormat } from '@grafana/data';
import { Position } from 'types';

export const getLinkValueFormatter = (formatId: string) => getValueFormat(formatId);

export const getLinkGraphFormatter =
  (formatId: string) =>
  (value: number): string => {
    const formatter = getValueFormat(formatId);
    const formattedValue = formatter(value);
    return `${formattedValue.text} ${formattedValue.suffix}`;
  };

// Get the middle point between two nodes
export function getMiddlePoint(source: Position, target: Position, offset: number): Position {
  const x = (source.x + target.x) / 2;
  const y = (source.y + target.y) / 2;
  const a = target.x - source.x;
  const b = target.y - source.y;
  const distance = Math.sqrt(a * a + b * b);
  const newX = x - (offset * (target.x - source.x)) / distance;
  const newY = y - (offset * (target.y - source.y)) / distance;
  return { x: newX, y: newY };
}

// Get a point a percentage of the way between two nodes
export function getPercentPoint(source: Position, target: Position, percent: number): Position {
  const newX = target.x + (source.x - target.x) * percent;
  const newY = target.y + (source.y - target.y) * percent;
  return { x: newX, y: newY };
}

// Find the points that create the two other points of a triangle for the arrow tip
export function getArrowPolygon(
  p1: Position,
  p2: Position,
  height: number,
  width: number
): { p1: Position; p2: Position } {
  const h = height;
  const w = width / 2;
  const vec1 = { x: p2.x - p1.x, y: p2.y - p1.y };
  const length = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
  vec1.x = vec1.x / length;
  vec1.y = vec1.y / length;
  const vec2 = { x: -vec1.y, y: vec1.x };
  const v1 = { x: p2.x - h * vec1.x + w * vec2.x, y: p2.y - h * vec1.y + w * vec2.y };
  const v2 = { x: p2.x - h * vec1.x - w * vec2.x, y: p2.y - h * vec1.y - w * vec2.y };
  return { p1: v1, p2: v2 };
}
