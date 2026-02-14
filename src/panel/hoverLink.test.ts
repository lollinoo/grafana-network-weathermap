import { Anchor, DrawnLink, DrawnLinkSide, DrawnNode } from 'types';
import { enrichHoveredLinkData } from './hoverLink';

const createSide = (overrides: Partial<DrawnLinkSide> = {}): DrawnLinkSide => ({
  bandwidth: 100,
  bandwidthQuery: undefined,
  query: 'query',
  labelOffset: 10,
  anchor: Anchor.Center,
  dashboardLink: '',
  currentValue: 10,
  currentText: '10',
  currentBandwidthText: '100',
  currentValueText: '10',
  currentPercentageText: '10%',
  ...overrides,
});

const createLink = (config: {
  id: string;
  sourceId: string;
  sourceIndex: number;
  targetId: string;
  targetIndex: number;
  sideA?: Partial<DrawnLinkSide>;
  sideZ?: Partial<DrawnLinkSide>;
}): DrawnLink => {
  const link = {
    id: config.id,
    nodes: [{ id: config.sourceId }, { id: config.targetId }],
    sides: {
      A: createSide(config.sideA),
      Z: createSide(config.sideZ),
    },
    units: 'bps',
    arrows: { width: 4, height: 4, offset: 4 },
    stroke: 2,
    showThroughputPercentage: false,
    index: 0,
    source: { id: config.sourceId, index: config.sourceIndex, label: config.sourceId },
    target: { id: config.targetId, index: config.targetIndex, label: config.targetId },
    lineStartA: { x: 0, y: 0 },
    lineEndA: { x: 0, y: 0 },
    arrowCenterA: { x: 0, y: 0 },
    arrowPolygonA: { p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 } },
    lineStartZ: { x: 0, y: 0 },
    lineEndZ: { x: 0, y: 0 },
    arrowCenterZ: { x: 0, y: 0 },
    arrowPolygonZ: { p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 } },
  };

  return link as DrawnLink;
};

const createNode = (id: string, index: number, isConnection: boolean): DrawnNode => {
  return { id, index, label: id, isConnection } as DrawnNode;
};

describe('enrichHoveredLinkData', () => {
  it('returns a cloned link and keeps values for non-connection nodes', () => {
    const link = createLink({
      id: 'link-1',
      sourceId: 'source',
      sourceIndex: 0,
      targetId: 'target',
      targetIndex: 1,
      sideA: { currentValue: 11 },
    });

    const nodes = [createNode('source', 0, false), createNode('target', 1, false)];
    const result = enrichHoveredLinkData(link, [link], nodes);

    expect(result).not.toBe(link);
    expect(result.sides).not.toBe(link.sides);
    expect(result.sides.A.currentValue).toBe(11);
    expect(link.sides.A.currentValue).toBe(11);
  });

  it('copies upstream A-side values for connection source without changing anchor/offset', () => {
    const hovered = createLink({
      id: 'hovered',
      sourceId: 'conn-source',
      sourceIndex: 0,
      targetId: 'target',
      targetIndex: 1,
      sideA: { currentValue: 1, anchor: Anchor.Left, labelOffset: 33 },
    });
    const upstream = createLink({
      id: 'upstream',
      sourceId: 'real-source',
      sourceIndex: 2,
      targetId: 'conn-source',
      targetIndex: 0,
      sideA: { currentValue: 99, anchor: Anchor.Right, labelOffset: 80 },
    });

    const nodes = [
      createNode('conn-source', 0, true),
      createNode('target', 1, false),
      createNode('real-source', 2, false),
    ];

    const result = enrichHoveredLinkData(hovered, [hovered, upstream], nodes);

    expect(result.sides.A.currentValue).toBe(99);
    expect(result.sides.A.anchor).toBe(Anchor.Left);
    expect(result.sides.A.labelOffset).toBe(33);
  });

  it('walks through connection chain to copy forward Z-side values', () => {
    const hovered = createLink({
      id: 'hovered',
      sourceId: 'source',
      sourceIndex: 0,
      targetId: 'conn-a',
      targetIndex: 1,
      sideZ: { currentValue: 2, anchor: Anchor.Top, labelOffset: 44 },
    });

    const forwardA = createLink({
      id: 'forward-a',
      sourceId: 'conn-a',
      sourceIndex: 1,
      targetId: 'conn-b',
      targetIndex: 2,
      sideZ: { currentValue: 20 },
    });

    const forwardB = createLink({
      id: 'forward-b',
      sourceId: 'conn-b',
      sourceIndex: 2,
      targetId: 'final-target',
      targetIndex: 3,
      sideZ: { currentValue: 75, anchor: Anchor.Bottom, labelOffset: 88 },
    });

    const nodes = [
      createNode('source', 0, false),
      createNode('conn-a', 1, true),
      createNode('conn-b', 2, true),
      createNode('final-target', 3, false),
    ];

    const result = enrichHoveredLinkData(hovered, [hovered, forwardA, forwardB], nodes);

    expect(result.sides.Z.currentValue).toBe(75);
    expect(result.sides.Z.anchor).toBe(Anchor.Top);
    expect(result.sides.Z.labelOffset).toBe(44);
  });

  it('warns when connection source has ambiguous upstream links', () => {
    const hovered = createLink({
      id: 'hovered',
      sourceId: 'conn-source',
      sourceIndex: 0,
      targetId: 'target',
      targetIndex: 1,
      sideA: { currentValue: 1 },
    });
    const upstreamA = createLink({
      id: 'upstream-a',
      sourceId: 'real-a',
      sourceIndex: 2,
      targetId: 'conn-source',
      targetIndex: 0,
      sideA: { currentValue: 20 },
    });
    const upstreamB = createLink({
      id: 'upstream-b',
      sourceId: 'real-b',
      sourceIndex: 3,
      targetId: 'conn-source',
      targetIndex: 0,
      sideA: { currentValue: 30 },
    });

    const nodes = [
      createNode('conn-source', 0, true),
      createNode('target', 1, false),
      createNode('real-a', 2, false),
      createNode('real-b', 3, false),
    ];
    const warn = jest.fn();

    const result = enrichHoveredLinkData(hovered, [hovered, upstreamA, upstreamB], nodes, warn);

    expect(result.sides.A.currentValue).toBe(1);
    expect(warn).toHaveBeenCalledWith('Connection node "conn-source" missing input connection.');
  });
});
