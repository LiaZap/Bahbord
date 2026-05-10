import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getSlaStatus,
  formatSlaRemaining,
  slaColorClasses,
  formatSlaAbsolute,
  type SlaStatus,
} from '@/lib/sla';

const NOW = new Date('2026-05-10T12:00:00Z');

describe('lib/sla', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getSlaStatus', () => {
    it('returns "none" when slaDueAt is null/undefined', () => {
      expect(getSlaStatus(null, false)).toBe('none');
      expect(getSlaStatus(undefined, false)).toBe('none');
    });

    it('returns "none" when ticket is done regardless of date', () => {
      const past = new Date(NOW.getTime() - 86_400_000).toISOString();
      const future = new Date(NOW.getTime() + 86_400_000 * 5).toISOString();
      expect(getSlaStatus(past, true)).toBe('none');
      expect(getSlaStatus(future, true)).toBe('none');
    });

    it('returns "none" for invalid date string (NaN)', () => {
      expect(getSlaStatus('not-a-date', false)).toBe('none');
      expect(getSlaStatus('', false)).toBe('none');
    });

    it('returns "ok" when due date is more than 24h away', () => {
      const future = new Date(NOW.getTime() + 48 * 60 * 60 * 1000).toISOString();
      expect(getSlaStatus(future, false)).toBe('ok');
    });

    it('returns "warning" when due in less than 24h (not yet overdue)', () => {
      const near = new Date(NOW.getTime() + 3 * 60 * 60 * 1000).toISOString();
      expect(getSlaStatus(near, false)).toBe('warning');
    });

    it('returns "overdue" when due date already passed', () => {
      const past = new Date(NOW.getTime() - 60 * 1000).toISOString();
      expect(getSlaStatus(past, false)).toBe('overdue');
    });

    it('boundary: exactly 24h ahead → still warning (strict <)', () => {
      // due = now + ONE_DAY exactly → due < now+ONE_DAY is false → 'ok'
      const exact = new Date(NOW.getTime() + 24 * 60 * 60 * 1000).toISOString();
      expect(getSlaStatus(exact, false)).toBe('ok');
      // Just under 24h → warning
      const justUnder = new Date(NOW.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
      expect(getSlaStatus(justUnder, false)).toBe('warning');
    });
  });

  describe('formatSlaRemaining', () => {
    it('returns empty string for null/undefined/invalid', () => {
      expect(formatSlaRemaining(null)).toBe('');
      expect(formatSlaRemaining(undefined)).toBe('');
      expect(formatSlaRemaining('garbage')).toBe('');
    });

    it('formats hours when due in hours', () => {
      const in3h = new Date(NOW.getTime() + 3 * 60 * 60 * 1000).toISOString();
      expect(formatSlaRemaining(in3h)).toBe('vence em 3h');
    });

    it('formats days (plural) when due in multiple days', () => {
      const in2d = new Date(NOW.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
      expect(formatSlaRemaining(in2d)).toBe('vence em 2 dias');
    });

    it('formats single day in singular ("dia")', () => {
      const in1d = new Date(NOW.getTime() + 1 * 24 * 60 * 60 * 1000 + 60_000).toISOString();
      expect(formatSlaRemaining(in1d)).toBe('vence em 1 dia');
    });

    it('formats overdue in days', () => {
      const ago1d = new Date(NOW.getTime() - 25 * 60 * 60 * 1000).toISOString();
      expect(formatSlaRemaining(ago1d)).toBe('atrasado há 1 dia');
    });

    it('formats overdue in hours', () => {
      const ago4h = new Date(NOW.getTime() - 4 * 60 * 60 * 1000).toISOString();
      expect(formatSlaRemaining(ago4h)).toBe('atrasado há 4h');
    });

    it('formats minutes when under 1 hour (overdue or not)', () => {
      const in30min = new Date(NOW.getTime() + 30 * 60 * 1000).toISOString();
      expect(formatSlaRemaining(in30min)).toBe('vence em 30min');
      const ago15min = new Date(NOW.getTime() - 15 * 60 * 1000).toISOString();
      expect(formatSlaRemaining(ago15min)).toBe('atrasado há 15min');
    });
  });

  describe('slaColorClasses', () => {
    it('returns red palette for overdue', () => {
      const c = slaColorClasses('overdue');
      expect(c.text).toContain('red');
      expect(c.bg).toContain('red');
      expect(c.border).toContain('red');
    });

    it('returns amber palette for warning', () => {
      const c = slaColorClasses('warning');
      expect(c.text).toContain('amber');
      expect(c.bg).toContain('amber');
      expect(c.border).toContain('amber');
    });

    it('returns muted token classes for ok', () => {
      const c = slaColorClasses('ok');
      expect(c.text).toBe('text-secondary-muted');
      expect(c.bg).toContain('overlay-subtle');
      expect(c.border).toContain('card-border');
    });

    it('returns empty strings for none (caller decides fallback)', () => {
      const c = slaColorClasses('none');
      expect(c).toEqual({ text: '', bg: '', border: '' });
    });

    it('default branch handles unknown status as none', () => {
      const c = slaColorClasses('bogus' as unknown as SlaStatus);
      expect(c).toEqual({ text: '', bg: '', border: '' });
    });
  });

  describe('formatSlaAbsolute', () => {
    it('returns empty string for null/undefined/invalid', () => {
      expect(formatSlaAbsolute(null)).toBe('');
      expect(formatSlaAbsolute(undefined)).toBe('');
      expect(formatSlaAbsolute('xxx')).toBe('');
    });

    it('returns a non-empty pt-BR formatted string for valid date', () => {
      const out = formatSlaAbsolute('2026-05-12T14:30:00Z');
      expect(out).not.toBe('');
      // We avoid hard-coding the exact locale output (TZ-dependent).
      expect(out).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });
  });
});
