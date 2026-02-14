import { DrawnLink, DrawnNode } from 'types';
import { measureText } from 'utils';
import { getLinkLabelMetrics, getLinkLabelTransform, shouldRenderLinkLabel } from './linkLabelLayout';

const createLink = (): DrawnLink =>
  ({
    nodes: [{ id: 'source' }, { id: 'target' }],
    target: { index: 1 },
    lineStartA: { x: 10, y: 20 },
    lineStartZ: { x: 30, y: 40 },
    sides: {
      A: { labelOffset: 50 },
      Z: { labelOffset: 40 },
    },
  } as unknown as DrawnLink);

const createNodes = (targetIsConnection = false): DrawnNode[] =>
  [{ isConnection: false }, { isConnection: targetIsConnection }] as unknown as DrawnNode[];

describe('linkLabelLayout helpers', () => {
  it('does not render labels for self links', () => {
    const link = createLink();
    link.nodes = [{ id: 'same' }, { id: 'same' }] as unknown as DrawnLink['nodes'];
    const nodes = createNodes(false);

    expect(shouldRenderLinkLabel(link, 'A', nodes)).toBe(false);
    expect(shouldRenderLinkLabel(link, 'Z', nodes)).toBe(false);
  });

  it('does not render Z labels when target is a connection node', () => {
    const link = createLink();
    const nodes = createNodes(true);

    expect(shouldRenderLinkLabel(link, 'A', nodes)).toBe(true);
    expect(shouldRenderLinkLabel(link, 'Z', nodes)).toBe(false);
  });

  it('calculates A-side label transform based on target connection state', () => {
    const link = createLink();

    expect(getLinkLabelTransform(link, 'A', createNodes(false))).toEqual({ x: 15, y: 25 });
    expect(getLinkLabelTransform(link, 'A', createNodes(true))).toEqual({ x: 20, y: 30 });
  });

  it('calculates Z-side label transform', () => {
    const link = createLink();

    expect(getLinkLabelTransform(link, 'Z', createNodes(false))).toEqual({ x: 26, y: 36 });
  });

  it('returns label metrics derived from measured text', () => {
    const measured = measureText('test', 12);
    const metrics = getLinkLabelMetrics('test', 12);

    expect(metrics.rectX).toBe(-measured.width / 2 - 9);
    expect(metrics.rectWidth).toBe(measured.width + 18);
    expect(metrics.rectHeight).toBe(24);
    expect(metrics.rectRadius).toBe(10);
  });
});
