'use client';

import { useState } from 'react';
import {
  Sparkles,
  User as UserIcon,
  AlertTriangle,
  Lightbulb,
  Target,
  CheckCircle2,
  PlusCircle,
  Clock,
  TrendingUp,
  Trash2,
  Pencil,
  Save,
  X,
  Lock,
  Bot,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import type {
  ProjectStatusSummary,
  ProjectUpdate,
} from './ProjectUpdatesList';

interface Props {
  update: ProjectUpdate;
  projectPrefix?: string;
  isAdmin: boolean;
  onSavePmNotes: (updateId: string, notes: string) => Promise<void>;
  onDelete: (updateId: string) => Promise<void>;
}

const severityStyles: Record<
  'high' | 'medium' | 'low',
  { wrap: string; label: string; dot: string }
> = {
  high: {
    wrap: 'border-red-500/40 bg-red-500/5',
    label: 'text-red-500 dark:text-red-400',
    dot: 'bg-red-500',
  },
  medium: {
    wrap: 'border-amber-500/40 bg-amber-500/5',
    label: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  low: {
    wrap: 'border-blue-500/40 bg-blue-500/5',
    label: 'text-blue-600 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
};

const severityLabel: Record<'high' | 'medium' | 'low', string> = {
  high: 'Alto',
  medium: 'Médio',
  low: 'Baixo',
};

function formatPeriod(from: string, to: string): string {
  const f = new Date(from);
  const t = new Date(to);
  if (isNaN(f.getTime()) || isNaN(t.getTime())) return '';
  return `Semana de ${format(f, 'dd/MM', { locale: ptBR })} a ${format(t, 'dd/MM/yyyy', { locale: ptBR })}`;
}

function safeAiSummary(raw: unknown): ProjectStatusSummary {
  // Normaliza o JSONB retornado pra um shape sempre seguro de renderizar.
  // Backend pode retornar tanto o shape novo (ProjectStatusSummary completo)
  // quanto o fallback minimal de lib/project-updates.ts.
  const r =
    raw && typeof raw === 'object'
      ? (raw as Record<string, unknown>)
      : {};

  const metricsRaw =
    r.metrics && typeof r.metrics === 'object'
      ? (r.metrics as Record<string, unknown>)
      : {};

  const metrics = {
    completed_count:
      typeof metricsRaw.completed_count === 'number'
        ? metricsRaw.completed_count
        : typeof r.completed_count === 'number'
          ? r.completed_count
          : 0,
    created_count:
      typeof metricsRaw.created_count === 'number'
        ? metricsRaw.created_count
        : 0,
    overdue_count:
      typeof metricsRaw.overdue_count === 'number'
        ? metricsRaw.overdue_count
        : typeof r.overdue_count === 'number'
          ? r.overdue_count
          : 0,
    priority_increased_count:
      typeof metricsRaw.priority_increased_count === 'number'
        ? metricsRaw.priority_increased_count
        : typeof r.priority_changes === 'number'
          ? r.priority_changes
          : 0,
    avg_resolution_hours:
      typeof metricsRaw.avg_resolution_hours === 'number'
        ? metricsRaw.avg_resolution_hours
        : null,
  };

  const highlights = Array.isArray(r.highlights)
    ? r.highlights.filter((h): h is string => typeof h === 'string')
    : [];

  const risksSrc = Array.isArray(r.risks) ? r.risks : [];
  const risks = risksSrc
    .map((it) => {
      if (typeof it === 'string') {
        return { severity: 'medium' as const, description: it };
      }
      if (it && typeof it === 'object') {
        const o = it as Record<string, unknown>;
        const sev =
          o.severity === 'high' ||
          o.severity === 'medium' ||
          o.severity === 'low'
            ? o.severity
            : 'medium';
        return {
          severity: sev,
          description:
            typeof o.description === 'string' ? o.description : '',
          ticket_keys: Array.isArray(o.ticket_keys)
            ? o.ticket_keys.filter(
                (k): k is string => typeof k === 'string',
              )
            : undefined,
        };
      }
      return null;
    })
    .filter(
      (
        x,
      ): x is {
        severity: 'high' | 'medium' | 'low';
        description: string;
        ticket_keys?: string[];
      } => x !== null && x.description !== '',
    );

  const blockersSrc = Array.isArray(r.blockers) ? r.blockers : [];
  const blockers = blockersSrc
    .map((it) => {
      if (typeof it === 'string') {
        return { ticket_key: '', title: it, reason: '' };
      }
      if (it && typeof it === 'object') {
        const o = it as Record<string, unknown>;
        return {
          ticket_key:
            typeof o.ticket_key === 'string' ? o.ticket_key : '',
          title: typeof o.title === 'string' ? o.title : '',
          reason: typeof o.reason === 'string' ? o.reason : '',
        };
      }
      return null;
    })
    .filter(
      (x): x is { ticket_key: string; title: string; reason: string } =>
        x !== null,
    );

  return {
    period:
      r.period && typeof r.period === 'object'
        ? (r.period as { from: string; to: string })
        : { from: '', to: '' },
    metrics,
    highlights,
    risks,
    blockers,
    summary: typeof r.summary === 'string' ? r.summary : '',
    next_focus: typeof r.next_focus === 'string' ? r.next_focus : '',
    generated_at:
      typeof r.generated_at === 'string' ? r.generated_at : '',
  };
}

export default function ProjectUpdateCard({
  update,
  projectPrefix,
  isAdmin,
  onSavePmNotes,
  onDelete,
}: Props) {
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const ai = safeAiSummary(update.ai_summary);

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(update.pm_notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    if (savingNotes) return;
    setSavingNotes(true);
    try {
      await onSavePmNotes(update.id, notesDraft);
      setEditingNotes(false);
      toast('Notas do PM salvas', 'success');
    } catch {
      toast('Erro ao salvar notas', 'error');
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleDelete() {
    if (deleting) return;
    const ok = await confirm({
      title: 'Excluir status update',
      message:
        'Esta ação remove o registro permanentemente. Tem certeza que deseja excluir?',
      confirmText: 'Excluir',
      variant: 'danger',
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await onDelete(update.id);
      toast('Update excluído', 'success');
    } catch {
      toast('Erro ao excluir', 'error');
      setDeleting(false);
    }
  }

  const generatedAt = update.generated_at
    ? formatDistanceToNow(new Date(update.generated_at), {
        addSuffix: true,
        locale: ptBR,
      })
    : '';

  const fallbackSummary =
    !ai.summary ||
    ai.summary.startsWith('Resumo automático indisponível');

  return (
    <article className="rounded-lg border border-[var(--card-border)] bg-[var(--overlay-subtle)] p-5 space-y-5">
      {/* Header */}
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h3 className="text-[15px] font-semibold text-primary">
            {formatPeriod(update.period_from, update.period_to)}
          </h3>
          <p className="text-[11px] text-tertiary-muted">
            Gerado {generatedAt}
            {update.pm_completed_at && update.pm_completed_by_name && (
              <>
                {' '}
                · Revisado por {update.pm_completed_by_name}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {update.generated_by_cron ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-2 py-0.5 text-[10px] font-medium text-secondary-muted">
              <Bot size={11} /> IA
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-2 py-0.5 text-[10px] font-medium text-secondary-muted">
              <UserIcon size={11} /> Manual
            </span>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded p-1 text-tertiary-muted transition hover:text-[var(--danger)] disabled:opacity-50"
              title="Excluir update"
              aria-label="Excluir update"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </header>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric
          icon={<CheckCircle2 size={14} />}
          label="Concluídos"
          value={ai.metrics.completed_count}
        />
        <Metric
          icon={<PlusCircle size={14} />}
          label="Criados"
          value={ai.metrics.created_count}
        />
        <Metric
          icon={<Clock size={14} />}
          label="Atrasados"
          value={ai.metrics.overdue_count}
          alert={ai.metrics.overdue_count > 0}
        />
        <Metric
          icon={<TrendingUp size={14} />}
          label="Tempo médio"
          value={
            ai.metrics.avg_resolution_hours != null
              ? `${ai.metrics.avg_resolution_hours.toFixed(1)}h`
              : '—'
          }
        />
      </div>

      {/* Resumo */}
      {ai.summary && (
        <section className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-tertiary-muted">
            Resumo
          </p>
          <p
            className={
              fallbackSummary
                ? 'text-[13px] italic leading-relaxed text-tertiary-muted'
                : 'text-[13px] leading-relaxed text-secondary-muted'
            }
          >
            {ai.summary}
          </p>
        </section>
      )}

      {/* Highlights */}
      {ai.highlights.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-tertiary-muted flex items-center gap-1.5">
            <Sparkles size={12} className="text-[var(--accent)]" />
            Destaques
          </p>
          <ul className="space-y-1.5">
            {ai.highlights.map((h, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[13px] text-secondary-muted leading-relaxed"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Risks */}
      {ai.risks.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-tertiary-muted flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-amber-500" />
            Riscos
          </p>
          <div className="space-y-2">
            {ai.risks.map((r, i) => {
              const s = severityStyles[r.severity];
              return (
                <div
                  key={i}
                  className={`rounded-md border px-3 py-2.5 ${s.wrap}`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${s.dot}`}
                    />
                    <div className="flex-1 space-y-1">
                      <p className="text-[13px] text-primary leading-relaxed">
                        {r.description}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wide ${s.label}`}
                        >
                          {severityLabel[r.severity]}
                        </span>
                        {r.ticket_keys && r.ticket_keys.length > 0 && (
                          <span className="text-[10px] font-mono text-tertiary-muted">
                            {r.ticket_keys.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Blockers */}
      {ai.blockers.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-tertiary-muted flex items-center gap-1.5">
            <Lock size={12} className="text-red-500" />
            Bloqueios
          </p>
          <ol className="space-y-2">
            {ai.blockers.map((b, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-3 py-2"
              >
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[11px] font-semibold text-[var(--accent)]">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {b.ticket_key && (
                      <a
                        href={`/tickets/${b.ticket_key}`}
                        className="font-mono text-[11px] text-[var(--accent)] hover:underline"
                      >
                        {b.ticket_key}
                      </a>
                    )}
                    {b.title && (
                      <span className="text-[13px] font-medium text-primary">
                        {b.title}
                      </span>
                    )}
                  </div>
                  {b.reason && (
                    <p className="text-[12px] text-secondary-muted leading-relaxed">
                      {b.reason}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Next focus callout */}
      {ai.next_focus && (
        <section className="rounded-md border border-blue-500/30 bg-blue-500/5 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 flex items-center gap-1.5 mb-1">
            <Target size={12} />
            Próximo foco
          </p>
          <p className="text-[13px] text-primary leading-relaxed">
            {ai.next_focus}
          </p>
        </section>
      )}

      {/* PM Notes */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-tertiary-muted flex items-center gap-1.5">
            <Lightbulb size={12} />
            Notas do PM
          </p>
          {!editingNotes && update.pm_notes && isAdmin && (
            <button
              type="button"
              onClick={() => {
                setNotesDraft(update.pm_notes ?? '');
                setEditingNotes(true);
              }}
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-secondary-muted transition hover:text-primary"
            >
              <Pencil size={11} /> Editar
            </button>
          )}
        </div>

        {editingNotes ? (
          <div className="space-y-2">
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={4}
              placeholder="Contexto adicional, decisões, próximos passos do PM…"
              className="w-full rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-3 py-2 text-[13px] text-primary outline-none transition focus:border-[var(--accent)]"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={savingNotes}
                className="btn-premium btn-primary"
              >
                {savingNotes ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Salvando…
                  </>
                ) : (
                  <>
                    <Save size={12} /> Salvar
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingNotes(false);
                  setNotesDraft(update.pm_notes ?? '');
                }}
                disabled={savingNotes}
                className="btn-premium btn-secondary"
              >
                <X size={12} /> Cancelar
              </button>
            </div>
          </div>
        ) : update.pm_notes ? (
          <p className="whitespace-pre-wrap rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-3 py-2.5 text-[13px] text-secondary-muted leading-relaxed">
            {update.pm_notes}
          </p>
        ) : isAdmin ? (
          <button
            type="button"
            onClick={() => {
              setNotesDraft('');
              setEditingNotes(true);
            }}
            className="w-full rounded-md border border-dashed border-[var(--card-border)] px-3 py-3 text-[12px] text-tertiary-muted transition hover:border-[var(--accent)] hover:text-primary"
          >
            + Adicionar notas do PM
          </button>
        ) : (
          <p className="rounded-md border border-dashed border-[var(--card-border)] px-3 py-3 text-[12px] text-tertiary-muted italic">
            Nenhuma nota do PM ainda.
          </p>
        )}
      </section>

      {projectPrefix && (
        <p className="sr-only">Projeto {projectPrefix}</p>
      )}
    </article>
  );
}

interface MetricProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  alert?: boolean;
}

function Metric({ icon, label, value, alert }: MetricProps) {
  return (
    <div className="rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-tertiary-muted">
        {icon}
        {label}
      </div>
      <p
        className={`mt-1 text-[18px] font-semibold tabular-nums ${
          alert ? 'text-amber-500 dark:text-amber-400' : 'text-primary'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
