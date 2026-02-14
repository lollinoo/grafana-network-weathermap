import React from 'react';
import { render, screen } from '@testing-library/react';
import { getData, theme } from 'testData';
import { CURRENT_VERSION } from 'utils';
import { WeathermapBuilder } from './WeathermapBuilder';

jest.mock('./NodeForm', () => ({
  NodeForm: () => <div data-testid="node-form" />,
}));

jest.mock('./LinkForm', () => ({
  LinkForm: () => <div data-testid="link-form" />,
}));

jest.mock('./ColorForm', () => ({
  ColorForm: () => <div data-testid="color-form" />,
}));

jest.mock('./PanelForm', () => ({
  PanelForm: () => <div data-testid="panel-form" />,
}));

describe('WeathermapBuilder', () => {
  it('initializes a default value when panel options are missing', () => {
    const onChange = jest.fn();

    render(
      <WeathermapBuilder value={undefined as any} onChange={onChange} context={{ data: [] } as any} item={{} as any} />
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0];
    expect(next.version).toBe(CURRENT_VERSION);
    expect(next.nodes).toHaveLength(2);
    expect(next.links).toHaveLength(1);
  });

  it('applies versioned state updates when value version is outdated', () => {
    const onChange = jest.fn();
    const oldValue = getData(theme);
    oldValue.version = 1;

    render(
      <WeathermapBuilder value={oldValue as any} onChange={onChange} context={{ data: [] } as any} item={{} as any} />
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0];
    expect(next.version).toBe(CURRENT_VERSION);
  });

  it('renders all builder sections when value is already current', () => {
    const onChange = jest.fn();
    const value = getData(theme);
    value.version = CURRENT_VERSION;

    render(
      <WeathermapBuilder value={value as any} onChange={onChange} context={{ data: [] } as any} item={{} as any} />
    );

    expect(screen.getByTestId('node-form')).toBeInTheDocument();
    expect(screen.getByTestId('link-form')).toBeInTheDocument();
    expect(screen.getByTestId('color-form')).toBeInTheDocument();
    expect(screen.getByTestId('panel-form')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
