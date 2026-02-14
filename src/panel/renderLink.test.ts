import { Anchor, DrawnLink, DrawnLinkSide, DrawnNode } from 'types';
import { buildRenderLinkContext } from './renderLink';

const createSide = (overrides: Partial<DrawnLinkSide> = {}): DrawnLinkSide => ({
  bandwidth: 100,
  bandwidthQuery: undefined,
  query: 'query',
  labelOffset: 20,
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
    stroke: 2,
    showThroughputPercentage: false,
    index: 0,
    source: { id: config.sourceId, index: config.sourceIndex, label: config.sourceId },
    target: { id: config.targetId, index: config.targetIndex, label: config.targetId },
    lineStartA: { x: 0, y: 0 },
    lineEndA: { x: 0, y: 0 },
    lineStartZ: { x: 0, y: 0 },
    lineEndZ: { x: 0, y: 0 },
  };

  return link as DrawnLink;
};

const createNode = (id: string, index: number, isConnection: boolean): DrawnNode => {
  return { id, index, label: id, isConnection } as DrawnNode;
};

describe('buildRenderLinkContext', () => {
  it('returns cloned link and no upstream links for non-connection source', () => {
    const link = createLink({
      id: 'link-1',
      sourceId: 'source',
      sourceIndex: 0,
      targetId: 'target',
      targetIndex: 1,
      sideA: { currentValue: 11 },
    });
    const nodes = [createNode('source', 0, false), createNode('target', 1, false)];

    const result = buildRenderLinkContext(link, [link], nodes);

    expect(result.link).not.toBe(link);
    expect(result.link.sides).not.toBe(link.sides);
    expect(result.link.sides.A.currentValue).toBe(11);
    expect(result.upstreamLinks).toEqual([]);
  });

  it('copies upstream side A values but preserves link anchor and label offset', () => {
    const link = createLink({
      id: 'link-1',
      sourceId: 'conn-source',
      sourceIndex: 0,
      targetId: 'target',
      targetIndex: 1,
      sideA: { currentValue: 1, anchor: Anchor.Left, labelOffset: 44 },
    });
    const upstream = createLink({
      id: 'upstream',
      sourceId: 'real-source',
      sourceIndex: 2,
      targetId: 'conn-source',
      targetIndex: 0,
      sideA: { currentValue: 80, anchor: Anchor.Right, labelOffset: 88 },
    });

    const nodes = [
      createNode('conn-source', 0, true),
      createNode('target', 1, false),
      createNode('real-source', 2, false),
    ];

    const result = buildRenderLinkContext(link, [link, upstream], nodes);

    expect(result.link.sides.A.currentValue).toBe(80);
    expect(result.link.sides.A.anchor).toBe(Anchor.Left);
    expect(result.link.sides.A.labelOffset).toBe(44);
    expect(result.upstreamLinks).toEqual([upstream]);
  });

  it('walks upstream connection chain', () => {
    const link = createLink({
      id: 'link-1',
      sourceId: 'conn-a',
      sourceIndex: 0,
      targetId: 'target',
      targetIndex: 1,
      sideA: { currentValue: 2 },
    });
    const mid = createLink({
      id: 'mid',
      sourceId: 'conn-b',
      sourceIndex: 2,
      targetId: 'conn-a',
      targetIndex: 0,
      sideA: { currentValue: 20 },
    });
    const root = createLink({
      id: 'root',
      sourceId: 'root-source',
      sourceIndex: 3,
      targetId: 'conn-b',
      targetIndex: 2,
      sideA: { currentValue: 70 },
    });

    const nodes = [
      createNode('conn-a', 0, true),
      createNode('target', 1, false),
      createNode('conn-b', 2, true),
      createNode('root-source', 3, false),
    ];

    const result = buildRenderLinkContext(link, [link, mid, root], nodes);

    expect(result.link.sides.A.currentValue).toBe(70);
    expect(result.upstreamLinks).toEqual([root]);
  });

  it('warns and keeps values when upstream links are ambiguous', () => {
    const link = createLink({
      id: 'link-1',
      sourceId: 'conn-source',
      sourceIndex: 0,
      targetId: 'target',
      targetIndex: 1,
      sideA: { currentValue: 3 },
    });
    const upstreamA = createLink({
      id: 'upstream-a',
      sourceId: 'real-a',
      sourceIndex: 2,
      targetId: 'conn-source',
      targetIndex: 0,
      sideA: { currentValue: 30 },
    });
    const upstreamB = createLink({
      id: 'upstream-b',
      sourceId: 'real-b',
      sourceIndex: 3,
      targetId: 'conn-source',
      targetIndex: 0,
      sideA: { currentValue: 40 },
    });
    const nodes = [
      createNode('conn-source', 0, true),
      createNode('target', 1, false),
      createNode('real-a', 2, false),
      createNode('real-b', 3, false),
    ];
    const warn = jest.fn();

    const result = buildRenderLinkContext(link, [link, upstreamA, upstreamB], nodes, warn);

    expect(result.link.sides.A.currentValue).toBe(3);
    expect(warn).toHaveBeenCalledWith('Connection node "conn-source" missing input connection.');
  });
});
