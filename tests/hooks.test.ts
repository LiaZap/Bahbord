import { describe, it, expect } from 'vitest';
import { formatDuration, formatMinutes } from '@/lib/hooks/useTimeTracking';

describe('formatDuration', () => {
  it('formats 0 seconds', () => {
    expect(formatDuration(0)).toBe('00:00:00');
  });

  it('formats seconds only', () => {
    expect(formatDuration(45)).toBe('00:00:45');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(125)).toBe('00:02:05');
  });

  it('formats hours, minutes and seconds', () => {
    expect(formatDuration(3661)).toBe('01:01:01');
  });

  it('formats large durations', () => {
    expect(formatDuration(36000)).toBe('10:00:00');
  });
});

describe('formatMinutes', () => {
  it('formats 0 minutes', () => {
    expect(formatMinutes(0)).toBe('0min');
  });

  it('formats minutes only', () => {
    expect(formatMinutes(45)).toBe('45min');
  });

  it('formats hours and minutes', () => {
    expect(formatMinutes(125)).toBe('2h 5min');
  });

  it('formats exact hours', () => {
    expect(formatMinutes(120)).toBe('2h 0min');
  });
});
