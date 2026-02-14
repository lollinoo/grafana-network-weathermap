import { Position, Weathermap } from 'types';

export function getZoomFactor(zoomScale: number): number {
  return Math.pow(1.2, zoomScale);
}

export function shouldAllowZoom(isEditMode: boolean, shiftPressed: boolean): boolean {
  return isEditMode || shiftPressed;
}

export function applyZoomDelta(weathermap: Weathermap, deltaY: number): Weathermap {
  const step = deltaY > 0 ? 1 : -1;

  return {
    ...weathermap,
    settings: {
      ...weathermap.settings,
      panel: {
        ...weathermap.settings.panel,
        zoomScale: weathermap.settings.panel.zoomScale + step,
      },
    },
  };
}

export function applyPanOffset(
  previousOffset: Position,
  movementX: number,
  movementY: number,
  zoomScale: number,
  aspectMultiplier: number
): Position {
  const zoomFactor = getZoomFactor(zoomScale);
  return {
    x: previousOffset.x + movementX * zoomFactor * aspectMultiplier,
    y: previousOffset.y + movementY * zoomFactor * aspectMultiplier,
  };
}
