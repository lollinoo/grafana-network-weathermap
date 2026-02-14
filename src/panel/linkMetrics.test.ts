import { DataFrame } from '@grafana/data';
import { Anchor, DrawnLink, DrawnLinkSide } from 'types';
import { buildDrawnLinkSidesWithMetrics, collectSeriesValuesByFrameId } from './linkMetrics';

const createDataFrame = (name: string, values: number[]): DataFrame =>
  ({
    name,
    fields: [
      { values: { get: () => 0, length: values.length } },
      { values: { get: (index: number) => values[index], length: values.length } },
    ],
  } as unknown as DataFrame);

const createSide = (overrides: Partial<DrawnLinkSide> = {}): DrawnLinkSide => ({
  bandwidth: 100,
  bandwidthQuery: undefined,
  query: undefined,
  labelOffset: 10,
  anchor: Anchor.Center,
  dashboardLink: '',
  currentValue: 0,
  currentText: 'n/a',
  currentBandwidthText: 'n/a',
  currentValueText: 'n/a',
  currentPercentageText: 'n/a%',
  ...overrides,
});

const createLink = (overrides?: {
  showThroughputPercentage?: boolean;
  sideA?: Partial<DrawnLinkSide>;
  sideZ?: Partial<DrawnLinkSide>;
}): DrawnLink =>
  ({
    id: 'link-1',
    nodes: [{ id: 'a' }, { id: 'z' }],
    sides: {
      A: createSide(overrides?.sideA),
      Z: createSide(overrides?.sideZ),
    },
    showThroughputPercentage: overrides?.showThroughputPercentage ?? false,
  } as unknown as DrawnLink);

describe('collectSeriesValuesByFrameId', () => {
  it('collects latest values and frame ids', () => {
    const frames = [createDataFrame('q1', [1, 2]), createDataFrame('q2', [3, 4])];

    const result = collectSeriesValuesByFrameId(frames, (frame) => frame.name || '');

    expect(result).toEqual([
      { id: 'q1', value: 2 },
      { id: 'q2', value: 4 },
    ]);
  });

  it('warns and skips frame when resolver throws', () => {
    const frames = [createDataFrame('ok', [1]), createDataFrame('bad', [2])];
    const warn = jest.fn();

    const result = collectSeriesValuesByFrameId(
      frames,
      (frame) => {
        if (frame.name === 'bad') {
          throw new Error('resolver failed');
        }
        return frame.name || '';
      },
      warn
    );

    expect(result).toEqual([{ id: 'ok', value: 1 }]);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('buildDrawnLinkSidesWithMetrics', () => {
  it('populates current and bandwidth text values from matching queries', () => {
    const link = createLink({
      sideA: { query: 'aQuery', bandwidthQuery: 'aBw', bandwidth: 1 },
      sideZ: { query: 'zQuery', bandwidthQuery: 'zBw', bandwidth: 1 },
    });

    const result = buildDrawnLinkSidesWithMetrics(
      link,
      [
        { id: 'aQuery', value: 20 },
        { id: 'aBw', value: 100 },
        { id: 'zQuery', value: 40 },
        { id: 'zBw', value: 80 },
      ],
      false,
      (value) => ({ text: value, suffix: 'bps' })
    );

    expect(result.A.currentValue).toBe(20);
    expect(result.A.currentValueText).toBe('20 bps');
    expect(result.A.currentPercentageText).toBe('20.00%');
    expect(result.A.currentText).toBe('20 bps');
    expect(result.A.currentBandwidthText).toBe('100 bps');

    expect(result.Z.currentValue).toBe(40);
    expect(result.Z.currentValueText).toBe('40 bps');
    expect(result.Z.currentPercentageText).toBe('50.00%');
    expect(result.Z.currentText).toBe('40 bps');
    expect(result.Z.currentBandwidthText).toBe('80 bps');
  });

  it('shows percentage text when configured globally', () => {
    const link = createLink({
      sideA: { query: 'aQuery', bandwidthQuery: 'aBw', bandwidth: 1 },
      sideZ: { query: 'zQuery', bandwidthQuery: 'zBw', bandwidth: 1 },
    });

    const result = buildDrawnLinkSidesWithMetrics(
      link,
      [
        { id: 'aQuery', value: 30 },
        { id: 'aBw', value: 60 },
        { id: 'zQuery', value: 5 },
        { id: 'zBw', value: 20 },
      ],
      true,
      (value) => ({ text: value, suffix: 'bps' })
    );

    expect(result.A.currentText).toBe('50.00%');
    expect(result.Z.currentText).toBe('25.00%');
  });

  it('sets bandwidth to zero when bandwidth query is configured but no value is found', () => {
    const link = createLink({
      sideA: { query: 'aQuery', bandwidthQuery: 'missingBw', bandwidth: 123 },
    });

    const result = buildDrawnLinkSidesWithMetrics(link, [{ id: 'aQuery', value: 5 }], false, (value) => ({
      text: value,
      suffix: 'bps',
    }));

    expect(result.A.bandwidth).toBe(0);
    expect(result.A.currentPercentageText).toBe('n/a%');
  });
});
