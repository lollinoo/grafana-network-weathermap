import { getArrowPolygon, getMiddlePoint, getPercentPoint } from './linkMath';

describe('linkMath helpers', () => {
  it('calculates middle point with and without offset', () => {
    expect(getMiddlePoint({ x: 0, y: 0 }, { x: 10, y: 0 }, 0)).toEqual({ x: 5, y: 0 });
    expect(getMiddlePoint({ x: 0, y: 0 }, { x: 10, y: 0 }, 2)).toEqual({ x: 3, y: 0 });
  });

  it('calculates percent point between source and target', () => {
    expect(getPercentPoint({ x: 0, y: 0 }, { x: 10, y: 10 }, 0.5)).toEqual({ x: 5, y: 5 });
    expect(getPercentPoint({ x: 0, y: 0 }, { x: 10, y: 10 }, 0.25)).toEqual({ x: 7.5, y: 7.5 });
  });

  it('calculates arrow polygon points from direction and dimensions', () => {
    const polygon = getArrowPolygon({ x: 0, y: 0 }, { x: 10, y: 0 }, 4, 6);
    expect(polygon).toEqual({
      p1: { x: 6, y: 3 },
      p2: { x: 6, y: -3 },
    });
  });
});
