import { AreaSize, Position } from 'types';
import { getZoomFactor } from './panelViewport';

export interface PanelGuideRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getZoomedPanelSize(panelSize: AreaSize, zoomScale: number): AreaSize {
  const zoomFactor = getZoomFactor(zoomScale);
  return {
    width: panelSize.width * zoomFactor,
    height: panelSize.height * zoomFactor,
  };
}

export function getPanelTranslateOffset(panelSize: AreaSize, zoomScale: number, offset: Position): Position {
  const zoomedPanelSize = getZoomedPanelSize(panelSize, zoomScale);
  return {
    x: (zoomedPanelSize.width - panelSize.width) / 2 + offset.x,
    y: (zoomedPanelSize.height - panelSize.height) / 2 + offset.y,
  };
}

export function getGridGuideRect(
  firstNodePosition: [number, number] | undefined,
  panelSize: AreaSize,
  zoomScale: number
): PanelGuideRect {
  const zoomedPanelSize = getZoomedPanelSize(panelSize, zoomScale);
  return {
    x: firstNodePosition ? firstNodePosition[0] - zoomedPanelSize.width * 2 : 0,
    y: firstNodePosition ? firstNodePosition[1] - zoomedPanelSize.height * 2 : 0,
    width: zoomedPanelSize.width * 4,
    height: zoomedPanelSize.height * 4,
  };
}
