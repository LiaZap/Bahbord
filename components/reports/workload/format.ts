/**
 * Funções puras de formatação para o heatmap de carga.
 * Sem React, sem side-effects — testáveis isoladamente.
 */

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(base: string, days: number): string {
  const d = new Date(base + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function defaultRange(): { from: string; to: string } {
  // hoje + 4 semanas (28 dias)
  const today = isoToday();
  return { from: today, to: addDaysISO(today, 27) };
}

/**
 * Format minutes as a compact load label.
 * - 0  -> '—'
 * - <60min -> 'Xm'
 * - <8h    -> 'Xh' (rounded to 0.5h)
 * - >=8h   -> 'Xd' (1 day = 8h)
 */
export function formatLoad(minutes: number): string {
  if (minutes <= 0) return '—';
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  if (hours < 8) {
    const rounded = Math.round(hours * 2) / 2;
    return `${rounded}h`;
  }
  const days = hours / 8;
  const roundedDays = Math.round(days * 10) / 10;
  return `${roundedDays}d`;
}

export function formatTotalHours(minutes: number): string {
  if (minutes <= 0) return '0h';
  const hours = minutes / 60;
  if (hours < 10) {
    return `${Math.round(hours * 10) / 10}h`;
  }
  return `${Math.round(hours)}h`;
}

function isoWeekNumber(d: Date): number {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = (target.getTime() - firstThursday.getTime()) / 86400000;
  return 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

export function formatWeekHeader(
  weekStart: string,
  weekEnd: string,
): { line1: string; line2: string } {
  const start = new Date(weekStart + 'T00:00:00Z');
  const end = new Date(weekEnd + 'T00:00:00Z');
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const startMonth = months[start.getUTCMonth()];
  const endMonth = months[end.getUTCMonth()];
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const line2 = sameMonth
    ? `${startDay}–${endDay} ${startMonth}`
    : `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
  // ISO week number
  const weekNumber = isoWeekNumber(start);
  return { line1: `Sem. ${weekNumber}`, line2 };
}

/**
 * Heatmap colour buckets (semantic):
 *   0          -> empty / no load   (overlay-subtle)
 *   1..240     -> light green       (até 4h ≈ meio dia leve)
 *   241..1200  -> medium green      (4h–20h, semana metade)
 *   1201..2400 -> amber             (20h–40h, semana cheia)
 *   2400+      -> red               (overcapacity, sobrecarga)
 *
 * Uses tailwind colours that hold up in both light and dark mode.
 */
export function cellClasses(minutes: number): {
  bg: string;
  text: string;
  border: string;
  level: 'empty' | 'light' | 'medium' | 'heavy' | 'over';
} {
  if (minutes <= 0) {
    return {
      bg: 'bg-[var(--overlay-subtle)]',
      text: 'text-tertiary-muted',
      border: 'border-[var(--card-border)]',
      level: 'empty',
    };
  }
  if (minutes <= 240) {
    return {
      bg: 'bg-emerald-500/15 dark:bg-emerald-500/15',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-500/25',
      level: 'light',
    };
  }
  if (minutes <= 1200) {
    return {
      bg: 'bg-emerald-500/35 dark:bg-emerald-500/30',
      text: 'text-emerald-800 dark:text-emerald-200',
      border: 'border-emerald-500/40',
      level: 'medium',
    };
  }
  if (minutes <= 2400) {
    return {
      bg: 'bg-amber-500/30 dark:bg-amber-500/25',
      text: 'text-amber-800 dark:text-amber-200',
      border: 'border-amber-500/40',
      level: 'heavy',
    };
  }
  return {
    bg: 'bg-rose-500/35 dark:bg-rose-500/30',
    text: 'text-rose-800 dark:text-rose-200',
    border: 'border-rose-500/45',
    level: 'over',
  };
}
