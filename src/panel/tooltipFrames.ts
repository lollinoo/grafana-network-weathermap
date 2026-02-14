import { DataFrame } from '@grafana/data';

type ResolveFrameName = (frame: DataFrame, allFrames: DataFrame[]) => string;
type WarnHandler = (error: unknown) => void;

function hasQuery(query: string | undefined): query is string {
  return typeof query === 'string' && query.length > 0;
}

export function filterFramesByQueries(
  frames: DataFrame[],
  queries: Array<string | undefined>,
  resolveFrameName: ResolveFrameName,
  warn: WarnHandler = () => {}
): DataFrame[] {
  const validQueries = queries.filter(hasQuery);
  if (validQueries.length === 0) {
    return [];
  }

  return frames.filter((frame) => {
    try {
      const displayName = resolveFrameName(frame, frames);
      return validQueries.includes(displayName);
    } catch (error) {
      warn(error);
      return false;
    }
  });
}

export function decorateTooltipFrames(
  frames: DataFrame[],
  allFrames: DataFrame[],
  inboundQuery: string | undefined,
  inboundColor: string,
  outboundColor: string,
  resolveFrameName: ResolveFrameName,
  warn: WarnHandler = () => {}
): DataFrame[] {
  return frames.map((frame) => {
    let isInboundQuery = false;

    try {
      isInboundQuery = resolveFrameName(frame, allFrames) === inboundQuery;
    } catch (error) {
      warn(error);
    }

    return {
      ...frame,
      fields: frame.fields.map((field) => ({
        ...field,
        config: {
          ...field.config,
          custom: {
            ...(field.config?.custom ?? {}),
            fillOpacity: 10,
            lineColor: isInboundQuery ? inboundColor : outboundColor,
          },
        },
      })),
    };
  });
}
