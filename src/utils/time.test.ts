import { describe, expect, it } from 'vitest';
import { roundToQuarterHour } from './time';

describe('roundToQuarterHour', () => {
  it('leaves exact quarter-hours unchanged', () => {
    expect(roundToQuarterHour('18:00')).toBe('18:00');
    expect(roundToQuarterHour('18:15')).toBe('18:15');
    expect(roundToQuarterHour('18:30')).toBe('18:30');
    expect(roundToQuarterHour('18:45')).toBe('18:45');
  });

  it('rounds to the nearest quarter-hour', () => {
    expect(roundToQuarterHour('18:07')).toBe('18:00');
    expect(roundToQuarterHour('18:08')).toBe('18:15');
    expect(roundToQuarterHour('18:53')).toBe('19:00');
  });

  it('wraps around midnight', () => {
    expect(roundToQuarterHour('23:53')).toBe('00:00');
  });

  it('passes through an empty string', () => {
    expect(roundToQuarterHour('')).toBe('');
  });
});
