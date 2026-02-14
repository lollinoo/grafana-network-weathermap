import { Weathermap } from 'types';
import { applyPanOffset, applyZoomDelta, getZoomFactor, shouldAllowZoom } from './panelViewport';

const createWeathermap = (zoomScale: number): Weathermap =>
  ({
    settings: {
      panel: {
        zoomScale,
      },
    },
  } as unknown as Weathermap);

describe('panelViewport helpers', () => {
  it('returns expected zoom factor', () => {
    expect(getZoomFactor(0)).toBe(1);
    expect(getZoomFactor(2)).toBeCloseTo(1.44);
  });

  it('allows zoom in edit mode or with shift key', () => {
    expect(shouldAllowZoom(true, false)).toBe(true);
    expect(shouldAllowZoom(false, true)).toBe(true);
    expect(shouldAllowZoom(false, false)).toBe(false);
  });

  it('applies zoom delta immutably', () => {
    const initial = createWeathermap(3);

    const zoomedOut = applyZoomDelta(initial, 10);
    const zoomedIn = applyZoomDelta(initial, -10);

    expect(zoomedOut.settings.panel.zoomScale).toBe(4);
    expect(zoomedIn.settings.panel.zoomScale).toBe(2);
    expect(initial.settings.panel.zoomScale).toBe(3);
  });

  it('applies pan offset using movement, zoom and aspect values', () => {
    const offset = applyPanOffset({ x: 10, y: 20 }, 5, -3, 1, 2);
    const zoomFactor = Math.pow(1.2, 1);

    expect(offset).toEqual({
      x: 10 + 5 * zoomFactor * 2,
      y: 20 + -3 * zoomFactor * 2,
    });
  });
});
