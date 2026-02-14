import { DataFrame } from '@grafana/data';
import { DrawnLink, DrawnLinkSide } from 'types';

export interface SeriesValueById {
  id: string;
  value: number | undefined;
}

type ResolveFrameName = (frame: DataFrame, allFrames: DataFrame[]) => string;
type WarnHandler = (error: unknown) => void;
type LinkValueFormatter = (value: number) => { text: string | number; suffix?: string };

function getSeriesValue(seriesValues: SeriesValueById[], query: string | undefined): number | undefined {
  if (!query) {
    return undefined;
  }

  const result = seriesValues.find((entry) => entry.id === query);
  return result?.value;
}

function formatLinkValue(formatter: LinkValueFormatter, value: number): string {
  const formattedValue = formatter(value);
  return `${formattedValue.text} ${formattedValue.suffix}`;
}

function buildDrawnLinkSideMetrics(
  side: DrawnLinkSide,
  seriesValues: SeriesValueById[],
  showPercentage: boolean,
  formatter: LinkValueFormatter
): DrawnLinkSide {
  const updatedSide: DrawnLinkSide = { ...side };

  if (updatedSide.bandwidthQuery) {
    const bandwidthValue = getSeriesValue(seriesValues, updatedSide.bandwidthQuery);
    updatedSide.bandwidth = bandwidthValue !== undefined ? bandwidthValue : 0;
  }

  updatedSide.currentValue = 0;
  updatedSide.currentText = 'n/a';
  updatedSide.currentValueText = 'n/a';
  updatedSide.currentPercentageText = 'n/a%';
  updatedSide.currentBandwidthText = 'n/a';

  const currentValue = getSeriesValue(seriesValues, updatedSide.query);
  if (currentValue !== undefined) {
    updatedSide.currentValue = currentValue;
    updatedSide.currentValueText = formatLinkValue(formatter, updatedSide.currentValue);
    updatedSide.currentPercentageText =
      updatedSide.bandwidth > 0 ? `${((updatedSide.currentValue / updatedSide.bandwidth) * 100).toFixed(2)}%` : 'n/a%';
  }

  updatedSide.currentText = showPercentage ? updatedSide.currentPercentageText : updatedSide.currentValueText;
  updatedSide.currentBandwidthText = formatLinkValue(formatter, updatedSide.bandwidth);

  return updatedSide;
}

export function collectSeriesValuesByFrameId(
  frames: DataFrame[],
  resolveFrameName: ResolveFrameName,
  warn: WarnHandler = () => {}
): SeriesValueById[] {
  const seriesValues: SeriesValueById[] = [];

  frames.forEach((frame) => {
    if (frame.fields.length < 2) {
      return;
    }

    try {
      seriesValues.push({
        value: frame.fields[1].values.get(frame.fields[1].values.length - 1),
        id: resolveFrameName(frame, frames),
      });
    } catch (error) {
      warn(error);
    }
  });

  return seriesValues;
}

export function buildDrawnLinkSidesWithMetrics(
  link: DrawnLink,
  seriesValues: SeriesValueById[],
  showAllWithPercentage: boolean,
  formatter: LinkValueFormatter
): DrawnLink['sides'] {
  return {
    A: buildDrawnLinkSideMetrics(
      link.sides.A,
      seriesValues,
      link.showThroughputPercentage || showAllWithPercentage,
      formatter
    ),
    Z: buildDrawnLinkSideMetrics(
      link.sides.Z,
      seriesValues,
      link.showThroughputPercentage || showAllWithPercentage,
      formatter
    ),
  };
}
