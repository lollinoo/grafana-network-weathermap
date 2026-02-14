import { defaultNodes, getData, theme } from 'testData';
import { DrawnNode, Weathermap } from 'types';
import {
  calculateRectangleAutoHeight,
  calculateRectangleAutoWidth,
  CURRENT_VERSION,
  getSolidFromAlphaColor,
  handleVersionedStateUpdates,
  measureText,
  nearestMultiple,
  openSafeUrl,
  sanitizeExternalUrl,
} from 'utils';

test('getSolidFromAlphaColor', () => {
  expect(getSolidFromAlphaColor('rgba(0, 0, 0, 0.5)', '#ffffff')).toBe('rgb(127.5,127.5,127.5)');
  expect(getSolidFromAlphaColor('#ffffff', '#ffffff')).toBe('#ffffff');
  expect(getSolidFromAlphaColor('rgba(255, 255, 255, 0.5)', '#000000')).toBe('rgb(127.5,127.5,127.5)');
});

// Doesn't work as expected in test env
test('measureText', () => {
  expect(measureText('test', 12)).toHaveProperty('width', 4);
});

test('nearestMultiple', () => {
  expect(nearestMultiple(5, 10)).toBe(10);
  expect(nearestMultiple(43, 10)).toBe(50);
});

test('node calculations', () => {
  let d: DrawnNode = defaultNodes[0] as unknown as DrawnNode;
  let wm: Weathermap = getData(theme);
  d.labelWidth = measureText(d.label!, 12).width;
  expect(calculateRectangleAutoHeight(d, wm)).toBe(18);
  expect(calculateRectangleAutoWidth(d, wm)).toBe(26);

  d.nodeIcon!.size = { width: 40, height: 40 };
  d.nodeIcon!.drawInside = true;

  expect(calculateRectangleAutoHeight(d, wm)).not.toBe(18);
  expect(calculateRectangleAutoWidth(d, wm)).not.toBe(26);
});

test('versioned state updates', () => {
  let wm: Weathermap = getData(theme);
  expect(handleVersionedStateUpdates(wm, theme)).toHaveProperty('version', CURRENT_VERSION);
});

test('sanitizeExternalUrl only allows safe schemes', () => {
  expect(sanitizeExternalUrl('https://example.com/path?q=1')).toBe('https://example.com/path?q=1');
  expect(sanitizeExternalUrl('/d/network-overview')).toBe('/d/network-overview');
  expect(sanitizeExternalUrl('javascript:alert(1)')).toBeUndefined();
  expect(sanitizeExternalUrl('//evil.example.com')).toBeUndefined();
  expect(sanitizeExternalUrl('\\\\evil.example.com')).toBeUndefined();
  expect(sanitizeExternalUrl('http:\\\\evil.example.com')).toBeUndefined();
  expect(sanitizeExternalUrl('http:\n//evil.example.com')).toBeUndefined();
  expect(sanitizeExternalUrl('\u0000https://example.com')).toBeUndefined();
  expect(sanitizeExternalUrl('data:text/html;base64,SGVsbG8=')).toBeUndefined();
  expect(sanitizeExternalUrl('data:image/svg+xml;base64,SGVsbG8=', { allowDataImage: true })).toBe(
    'data:image/svg+xml;base64,SGVsbG8='
  );
});

test('openSafeUrl only opens sanitized urls', () => {
  const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

  openSafeUrl('javascript:alert(1)');
  expect(openSpy).not.toHaveBeenCalled();

  openSafeUrl('//evil.example.com');
  expect(openSpy).not.toHaveBeenCalled();

  openSafeUrl('https://example.com/network');
  expect(openSpy).toHaveBeenCalledWith('https://example.com/network', '_blank', 'noopener,noreferrer');

  openSpy.mockRestore();
});
