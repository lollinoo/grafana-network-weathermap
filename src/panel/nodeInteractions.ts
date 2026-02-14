import { DrawnNode, Position, Weathermap } from 'types';
import { nearestMultiple } from 'utils';

export function toggleSelectedNode(selectedNodes: DrawnNode[], node: DrawnNode): DrawnNode[] {
  if (selectedNodes.some((selected) => selected.id === node.id)) {
    return selectedNodes.filter((selected) => selected.id !== node.id);
  }

  return [...selectedNodes, node];
}

export function applyNodeDrag(
  prevNodes: DrawnNode[],
  selectedNodes: DrawnNode[],
  activeIndex: number,
  delta: Position
): DrawnNode[] {
  const selectedIds = new Set(selectedNodes.map((node) => node.id));

  return prevNodes.map((node, index) => {
    if (index !== activeIndex && !selectedIds.has(node.id)) {
      return node;
    }

    return {
      ...node,
      x: Math.round(node.x + delta.x),
      y: Math.round(node.y + delta.y),
    };
  });
}

export function commitNodePositions(
  weathermap: Weathermap,
  nodes: DrawnNode[],
  activeIndex: number,
  selectedNodes: DrawnNode[]
): Weathermap {
  const gridEnabled = weathermap.settings.panel.grid.enabled;
  const gridSize = weathermap.settings.panel.grid.size;
  const indicesToCommit = new Set<number>([activeIndex, ...selectedNodes.map((node) => node.index)]);

  return {
    ...weathermap,
    nodes: weathermap.nodes.map((node, index) => {
      if (!indicesToCommit.has(index)) {
        return node;
      }

      return {
        ...node,
        position: [
          gridEnabled ? nearestMultiple(nodes[index].x, gridSize) : nodes[index].x,
          gridEnabled ? nearestMultiple(nodes[index].y, gridSize) : nodes[index].y,
        ],
      };
    }),
  };
}

export function commitPanelOffset(weathermap: Weathermap, offset: Position): Weathermap {
  return {
    ...weathermap,
    settings: {
      ...weathermap.settings,
      panel: {
        ...weathermap.settings.panel,
        offset: { ...offset },
      },
    },
  };
}
