import { DataFrame } from '@grafana/data';
import { decorateTooltipFrames, filterFramesByQueries } from './tooltipFrames';

const createFrame = (displayName: string): DataFrame =>
  ({
    name: displayName,
    fields: [
      {
        name: 'value',
        config: {},
      },
    ],
  } as unknown as DataFrame);

const resolveFrameName = (frame: DataFrame): string => frame.name || '';

describe('filterFramesByQueries', () => {
  it('returns only frames that match at least one query', () => {
    const frames = [createFrame('A'), createFrame('B'), createFrame('C')];

    const filtered = filterFramesByQueries(frames, ['B', 'C'], resolveFrameName);

    expect(filtered.map((frame) => frame.name)).toEqual(['B', 'C']);
  });

  it('returns empty list when no valid query is provided', () => {
    const frames = [createFrame('A')];

    const filtered = filterFramesByQueries(frames, [undefined, ''], resolveFrameName);

    expect(filtered).toEqual([]);
  });

  it('warns and skips frame when resolver throws', () => {
    const frames = [createFrame('A'), createFrame('B')];
    const warn = jest.fn();

    const filtered = filterFramesByQueries(
      frames,
      ['A', 'B'],
      (frame) => {
        if (frame.name === 'B') {
          throw new Error('resolver failed');
        }
        return frame.name || '';
      },
      warn
    );

    expect(filtered.map((frame) => frame.name)).toEqual(['A']);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('decorateTooltipFrames', () => {
  it('decorates frames immutably with inbound/outbound line colors', () => {
    const inbound = createFrame('inbound');
    const outbound = createFrame('outbound');
    const allFrames = [inbound, outbound];

    const decorated = decorateTooltipFrames(allFrames, allFrames, 'inbound', '#00ff00', '#ff0000', resolveFrameName);

    expect((decorated[0].fields[0].config.custom as any).lineColor).toBe('#00ff00');
    expect((decorated[1].fields[0].config.custom as any).lineColor).toBe('#ff0000');
    expect((decorated[0].fields[0].config.custom as any).fillOpacity).toBe(10);

    // Ensure original frames are not mutated.
    expect((inbound.fields[0].config.custom as any)?.lineColor).toBeUndefined();
    expect((outbound.fields[0].config.custom as any)?.lineColor).toBeUndefined();
  });

  it('warns when resolver throws and falls back to outbound color', () => {
    const frame = createFrame('broken');
    const warn = jest.fn();

    const decorated = decorateTooltipFrames(
      [frame],
      [frame],
      'inbound',
      '#00ff00',
      '#ff0000',
      () => {
        throw new Error('resolver failed');
      },
      warn
    );

    expect((decorated[0].fields[0].config.custom as any).lineColor).toBe('#ff0000');
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
