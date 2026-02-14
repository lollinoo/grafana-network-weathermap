import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { getData, theme } from 'testData';
import { Weathermap } from 'types';
import { PanelForm } from './PanelForm';

function renderPanelForm(value: Weathermap, onChange = jest.fn()) {
  render(<PanelForm value={value as any} onChange={onChange} context={{ data: [] } as any} item={{} as any} />);
  return { onChange };
}

describe('PanelForm', () => {
  it('adds background image settings when clicking the add image button', () => {
    const value = getData(theme);
    value.settings.panel.backgroundImage = undefined;
    const { onChange } = renderPanelForm(value);

    fireEvent.click(screen.getByLabelText('Add background image'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0];
    expect(next.settings.panel.backgroundImage).toEqual({
      url: '',
      fit: 'contain',
    });
  });

  it('does not remove background image when removal confirm is declined', () => {
    const value = getData(theme);
    value.settings.panel.backgroundImage = {
      url: 'https://example.com/bg.png',
      fit: 'cover',
    };
    const { onChange } = renderPanelForm(value);
    const previousConfirm = (globalThis as any).confirm;
    (globalThis as any).confirm = jest.fn(() => false);

    fireEvent.click(screen.getByLabelText('Remove background image'));

    expect(onChange).not.toHaveBeenCalled();
    (globalThis as any).confirm = previousConfirm;
  });

  it('resets per-link units when confirmation is accepted', () => {
    const value = getData(theme);
    value.links.forEach((link) => {
      link.units = 'Mbps';
    });
    const { onChange } = renderPanelForm(value);
    const previousConfirm = (globalThis as any).confirm;
    (globalThis as any).confirm = jest.fn(() => true);

    fireEvent.click(screen.getByLabelText('Reset link units'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0];
    expect(next.links.every((link: any) => link.units === undefined)).toBe(true);
    (globalThis as any).confirm = previousConfirm;
  });
});
