import { getGridGuideRect, getPanelTranslateOffset, getZoomedPanelSize } from './panelCanvas';

describe('panelCanvas helpers', () => {
  it('returns the zoomed panel size', () => {
    const size = getZoomedPanelSize({ width: 1000, height: 500 }, 1);
    expect(size).toEqual({ width: 1200, height: 600 });
  });

  it('returns panel translate offset using zoom centering and current pan offset', () => {
    const translate = getPanelTranslateOffset({ width: 1000, height: 500 }, 1, { x: 10, y: -5 });
    expect(translate).toEqual({ x: 110, y: 45 });
  });

  it('returns a grid guide rect starting at origin when first node is missing', () => {
    const rect = getGridGuideRect(undefined, { width: 1000, height: 500 }, 1);
    expect(rect).toEqual({ x: 0, y: 0, width: 4800, height: 2400 });
  });

  it('returns a centered grid guide rect around the first node position', () => {
    const rect = getGridGuideRect([100, 200], { width: 1000, height: 500 }, 1);
    expect(rect).toEqual({ x: -2300, y: -1000, width: 4800, height: 2400 });
  });
});
