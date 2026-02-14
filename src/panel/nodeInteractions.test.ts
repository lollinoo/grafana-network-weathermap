import { DrawnNode, Weathermap } from 'types';
import { applyNodeDrag, commitNodePositions, commitPanelOffset, toggleSelectedNode } from './nodeInteractions';

const createDrawnNode = (id: string, index: number, x: number, y: number): DrawnNode => {
  return { id, index, x, y, position: [x, y] } as DrawnNode;
};

const createWeathermap = (
  nodes: DrawnNode[],
  options: { gridEnabled: boolean; gridSize: number; offsetX?: number; offsetY?: number }
): Weathermap => {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      position: [node.x, node.y],
    })),
    settings: {
      panel: {
        grid: {
          enabled: options.gridEnabled,
          size: options.gridSize,
        },
        offset: {
          x: options.offsetX ?? 0,
          y: options.offsetY ?? 0,
        },
      },
    },
  } as unknown as Weathermap;
};

describe('toggleSelectedNode', () => {
  it('adds a node when not already selected', () => {
    const node = createDrawnNode('a', 0, 10, 20);
    const result = toggleSelectedNode([], node);

    expect(result).toEqual([node]);
  });

  it('removes a node when already selected', () => {
    const node = createDrawnNode('a', 0, 10, 20);
    const result = toggleSelectedNode([node], node);

    expect(result).toEqual([]);
  });
});

describe('applyNodeDrag', () => {
  it('moves active and selected nodes only', () => {
    const n0 = createDrawnNode('n0', 0, 10, 10);
    const n1 = createDrawnNode('n1', 1, 20, 20);
    const n2 = createDrawnNode('n2', 2, 30, 30);

    const result = applyNodeDrag([n0, n1, n2], [n2], 0, { x: 5.4, y: -3.2 });

    expect(result[0].x).toBe(15);
    expect(result[0].y).toBe(7);
    expect(result[2].x).toBe(35);
    expect(result[2].y).toBe(27);
    expect(result[1]).toBe(n1);
  });
});

describe('commitNodePositions', () => {
  it('commits active and selected node positions with grid snapping when enabled', () => {
    const n0 = createDrawnNode('n0', 0, 13, 21);
    const n1 = createDrawnNode('n1', 1, 26, 34);
    const n2 = createDrawnNode('n2', 2, 39, 42);
    const wm = createWeathermap([n0, n1, n2], { gridEnabled: true, gridSize: 10 });

    const result = commitNodePositions(wm, [n0, n1, n2], 0, [n2]);

    expect(result.nodes[0].position).toEqual([20, 30]);
    expect(result.nodes[2].position).toEqual([40, 50]);
    expect(result.nodes[1].position).toEqual([26, 34]);
  });

  it('commits exact positions when grid is disabled', () => {
    const n0 = createDrawnNode('n0', 0, 13, 21);
    const n1 = createDrawnNode('n1', 1, 26, 34);
    const wm = createWeathermap([n0, n1], { gridEnabled: false, gridSize: 10 });

    const result = commitNodePositions(wm, [n0, n1], 1, []);

    expect(result.nodes[1].position).toEqual([26, 34]);
  });
});

describe('commitPanelOffset', () => {
  it('returns weathermap with updated panel offset immutably', () => {
    const wm = createWeathermap([createDrawnNode('n0', 0, 10, 20)], {
      gridEnabled: false,
      gridSize: 10,
      offsetX: 1,
      offsetY: 2,
    });

    const result = commitPanelOffset(wm, { x: 100, y: 200 });

    expect(result.settings.panel.offset).toEqual({ x: 100, y: 200 });
    expect(wm.settings.panel.offset).toEqual({ x: 1, y: 2 });
  });
});
