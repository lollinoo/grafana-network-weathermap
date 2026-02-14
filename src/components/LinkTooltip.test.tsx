import React from 'react';
import { TimeRange } from '@grafana/data';
import { render, screen } from '@testing-library/react';
import { LinkTooltip } from './LinkTooltip';
import { HoveredLink, Weathermap } from 'types';

const createWeathermap = (): Weathermap =>
  ({
    settings: {
      tooltip: {
        fontSize: 12,
        textColor: '#ffffff',
        backgroundColor: '#111111',
        inboundColor: '#00ff00',
        outboundColor: '#ff0000',
        scaleToBandwidth: true,
      },
      link: {
        defaultUnits: 'bps',
      },
    },
  } as unknown as Weathermap);

const createHoveredLink = (): HoveredLink =>
  ({
    side: 'A',
    mouseEvent: {
      nativeEvent: {
        layerX: 25,
        layerY: 50,
      },
    },
    link: {
      units: 'bps',
      nodes: [{ label: 'Node A' }, { label: 'Node Z' }],
      sides: {
        A: {
          currentValue: 15,
          bandwidth: 100,
          currentValueText: '15 bps',
          currentBandwidthText: '100 bps',
          currentPercentageText: '15%',
          query: undefined,
        },
        Z: {
          currentValue: 12,
          bandwidth: 100,
          currentValueText: '12 bps',
          currentBandwidthText: '100 bps',
          currentPercentageText: '12%',
          query: undefined,
        },
      },
    },
  } as unknown as HoveredLink);

describe('LinkTooltip', () => {
  const timeRange = {} as unknown as TimeRange;

  it('does not render when hovered link is missing', () => {
    const { container } = render(
      <LinkTooltip
        hoveredLink={null}
        weathermap={createWeathermap()}
        filteredGraphQueries={[]}
        tooltipGraphFrames={[]}
        timeRange={timeRange}
        safeDashboardUrl={undefined}
        borderColor="#333333"
        getScaleColor={() => '#999999'}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders tooltip text content for the hovered link', () => {
    render(
      <LinkTooltip
        hoveredLink={createHoveredLink()}
        weathermap={createWeathermap()}
        filteredGraphQueries={[]}
        tooltipGraphFrames={[]}
        timeRange={timeRange}
        safeDashboardUrl="/d/network"
        borderColor="#333333"
        getScaleColor={() => '#999999'}
      />
    );

    expect(screen.getByText('Node A ---> Node Z')).toBeInTheDocument();
    expect(screen.getByText(/Usage - Inbound: 12 bps, Outbound: 15 bps/)).toBeInTheDocument();
    expect(screen.getByText('Click to see more.')).toBeInTheDocument();
  });
});
