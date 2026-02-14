import React from 'react';
import { DataFrame, getTimeZone, TimeRange } from '@grafana/data';
import { LegendDisplayMode, TimeSeries, TooltipDisplayMode, TooltipPlugin } from '@grafana/ui';
import { css } from 'emotion';
import { getLinkGraphFormatter } from 'panel/linkMath';
import { HoveredLink, Weathermap } from 'types';

interface LinkTooltipProps {
  hoveredLink: HoveredLink | null;
  weathermap: Weathermap;
  filteredGraphQueries: DataFrame[];
  tooltipGraphFrames: DataFrame[];
  timeRange: TimeRange;
  safeDashboardUrl?: string;
  borderColor: string;
  getScaleColor: (current: number, max: number) => string;
}

export const LinkTooltip: React.FC<LinkTooltipProps> = ({
  hoveredLink,
  weathermap,
  filteredGraphQueries,
  tooltipGraphFrames,
  timeRange,
  safeDashboardUrl,
  borderColor,
  getScaleColor,
}) => {
  if (!hoveredLink) {
    return null;
  }

  const fontSize = weathermap.settings.tooltip.fontSize;

  return (
    <div
      className={css`
        position: absolute;
        top: ${hoveredLink.mouseEvent.nativeEvent.layerY}px;
        left: ${hoveredLink.mouseEvent.nativeEvent.layerX}px;
        transform: translate(0%, -100%);
        background-color: ${weathermap.settings.tooltip.backgroundColor};
        color: ${weathermap.settings.tooltip.textColor} !important;
        font-size: ${fontSize} !important;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        padding: ${fontSize}px;
        border-radius: 4px;
        border: 1px solid
          ${getScaleColor(
            hoveredLink.link.sides[hoveredLink.side].currentValue,
            hoveredLink.link.sides[hoveredLink.side].bandwidth
          )};
      `}
    >
      <div
        style={{
          fontSize,
          borderBottom: `1px solid ${borderColor}`,
          marginBottom: '4px',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {hoveredLink.link.nodes[0].label} {hoveredLink.side === 'A' ? '--->' : '<---'} {hoveredLink.link.nodes[1].label}
      </div>
      <div style={{ fontSize }}>
        Usage - Inbound: {hoveredLink.link.sides.Z.currentValueText}, Outbound:{' '}
        {hoveredLink.link.sides.A.currentValueText}
      </div>
      <div style={{ fontSize }}>
        Bandwidth - Inbound: {hoveredLink.link.sides.Z.currentBandwidthText}, Outbound:{' '}
        {hoveredLink.link.sides.A.currentBandwidthText}
      </div>
      <div style={{ fontSize }}>
        Throughput (%) - Inbound: {hoveredLink.link.sides.Z.currentPercentageText}, Outbound:{' '}
        {hoveredLink.link.sides.A.currentPercentageText}
      </div>
      <div style={{ fontSize, paddingBottom: '4px' }}>{safeDashboardUrl ? 'Click to see more.' : ''}</div>
      {(hoveredLink.link.sides.A.query || hoveredLink.link.sides.Z.query) && filteredGraphQueries.length > 0 ? (
        <React.Fragment>
          <TimeSeries
            width={250}
            height={100}
            timeRange={timeRange}
            timeZone={getTimeZone()}
            frames={tooltipGraphFrames}
            legend={{
              calcs: [],
              displayMode: LegendDisplayMode.List,
              placement: 'bottom',
              isVisible: true,
              showLegend: false,
            }}
            tweakScale={(opts) => {
              opts.softMin = 0;
              if (
                weathermap.settings.tooltip.scaleToBandwidth &&
                hoveredLink.link.sides[hoveredLink.side].bandwidth > 0
              ) {
                opts.softMax = hoveredLink.link.sides[hoveredLink.side].bandwidth;
              }
              return opts;
            }}
            tweakAxis={(opts) => {
              opts.formatValue = getLinkGraphFormatter(
                hoveredLink.link.units
                  ? hoveredLink.link.units
                  : weathermap.settings.link.defaultUnits
                  ? weathermap.settings.link.defaultUnits
                  : 'bps'
              );
              return opts;
            }}
          >
            {(config, alignedDataFrame) => {
              return (
                <TooltipPlugin
                  config={config}
                  data={alignedDataFrame}
                  mode={TooltipDisplayMode.Multi}
                  timeZone={getTimeZone()}
                />
              );
            }}
          </TimeSeries>
          <div style={{ display: 'flex', alignItems: 'center', paddingTop: '10px' }}>
            <div
              style={{
                width: '10px',
                height: '3px',
                background: weathermap.settings.tooltip.inboundColor,
                paddingLeft: '5px',
                marginRight: '4px',
              }}
            ></div>
            <div style={{ fontSize }}>Inbound</div>
            <div
              style={{
                width: '10px',
                height: '3px',
                background: weathermap.settings.tooltip.outboundColor,
                marginLeft: '10px',
                marginRight: '4px',
              }}
            ></div>
            <div style={{ fontSize }}>Outbound</div>
          </div>
        </React.Fragment>
      ) : (
        ''
      )}
    </div>
  );
};
