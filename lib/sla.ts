/**
 * Helpers de SLA para a UI.
 *
 * Status:
 *   - none     → ticket não tem SLA setado OU já foi concluído
 *   - ok       → vence em mais de 24h
 *   - warning  → vence nas próximas 24h
 *   - overdue  → já passou da data de vencimento
 *
 * Convenção: "warning" = janela das próximas 24h. Mantemos esse threshold
 * batendo com o filtro server-side em `/api/tickets?sla_status=warning`
 * (ver app/api/tickets/route.ts).
 */
export type SlaStatus = 'ok' | 'warning' | 'overdue' | 'none';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

export function getSlaStatus(
  slaDueAt: string | null | undefined,
  isDone: boolean
): SlaStatus {
  if (!slaDueAt || isDone) return 'none';
  const due = new Date(slaDueAt).getTime();
  if (Number.isNaN(due)) return 'none';
  const now = Date.now();
  if (due < now) return 'overdue';
  if (due < now + ONE_DAY_MS) return 'warning';
  return 'ok';
}

/**
 * Retorna texto curto em PT-BR descrevendo o tempo restante (ou atrasado).
 * Ex: "vence em 3h", "vence em 2 dias", "atrasado há 1 dia", "atrasado há 4h".
 */
export function formatSlaRemaining(slaDueAt: string | null | undefined): string {
  if (!slaDueAt) return '';
  const due = new Date(slaDueAt).getTime();
  if (Number.isNaN(due)) return '';
  const now = Date.now();
  const diff = due - now;
  const abs = Math.abs(diff);
  const overdue = diff < 0;

  let value: number;
  let unit: string;
  if (abs < ONE_HOUR_MS) {
    value = Math.max(1, Math.floor(abs / ONE_MINUTE_MS));
    unit = value === 1 ? 'min' : 'min';
  } else if (abs < ONE_DAY_MS) {
    value = Math.max(1, Math.floor(abs / ONE_HOUR_MS));
    unit = 'h';
  } else {
    value = Math.max(1, Math.floor(abs / ONE_DAY_MS));
    unit = value === 1 ? 'dia' : 'dias';
  }

  // "h" e "min" não pluralizam ("3h", "45min"); só "dia/dias"
  const label = unit === 'h' || unit === 'min' ? `${value}${unit}` : `${value} ${unit}`;
  return overdue ? `atrasado há ${label}` : `vence em ${label}`;
}

/**
 * Mapeia status SLA pra classes Tailwind (text/bg/border).
 * Não usa text-white nem text-slate-XXX hardcoded — segue tokens da Sprint 1.
 *
 * - overdue: vermelho (igual paleta de prioridade urgente)
 * - warning: âmbar
 * - ok / none: vazio (deixa caller decidir o fallback)
 */
export function slaColorClasses(
  status: SlaStatus
): { text: string; bg: string; border: string } {
  switch (status) {
    case 'overdue':
      return {
        text: 'text-red-400',
        bg: 'bg-red-500/15',
        border: 'border-red-500/30',
      };
    case 'warning':
      return {
        text: 'text-amber-400',
        bg: 'bg-amber-500/15',
        border: 'border-amber-500/30',
      };
    case 'ok':
      return {
        text: 'text-secondary-muted',
        bg: 'bg-[var(--overlay-subtle)]',
        border: 'border-[var(--card-border)]',
      };
    case 'none':
    default:
      return { text: '', bg: '', border: '' };
  }
}

/**
 * Formata data SLA pra exibir absoluto (ex: "12/05/2026 14:30").
 */
export function formatSlaAbsolute(slaDueAt: string | null | undefined): string {
  if (!slaDueAt) return '';
  const d = new Date(slaDueAt);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
