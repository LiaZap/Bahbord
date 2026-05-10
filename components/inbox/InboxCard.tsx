'use client';

import { forwardRef, useMemo } from 'react';
import {
  AtSign,
  Bug,
  Check,
  Github,
  Hash,
  Link as LinkIcon,
  Mail,
  Pencil,
  Slack,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { cn } from '@/lib/utils/cn';
import type { InboxItem, InboxStatus } from './types';

interface InboxCardProps {
  item: InboxItem;
  isFocused: boolean;
  isReadOnly?: boolean;
  onFocus: () => void;
  onAccept: () => void;
  onDuplicate: () => void;
  onReject: () => void;
  membersById: Map<string, { id: string; display_name?: string; avatar_url?: string | null }>;
  projectsById: Map<string, { id: string; name: string; color?: string | null }>;
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `há ${days}d`;
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

const sourceMeta: Record<
  string,
  { Icon: typeof Slack; label: string; color: string }
> = {
  slack: { Icon: Slack, label: 'Slack', color: '#611f69' },
  github: { Icon: Github, label: 'GitHub', color: '#6e7681' },
  email: { Icon: Mail, label: 'Email', color: '#0ea5e9' },
  share_link: { Icon: LinkIcon, label: 'Link público', color: '#22c55e' },
  sentry: { Icon: Bug, label: 'Sentry', color: '#f43f5e' },
  manual: { Icon: Pencil, label: 'Manual', color: '#a855f7' },
};

const priorityMeta: Record<
  string,
  { label: string; color: string }
> = {
  urgent: { label: 'Urgente', color: '#ef4444' },
  high: { label: 'Alta', color: '#f97316' },
  medium: { label: 'Média', color: '#eab308' },
  low: { label: 'Baixa', color: '#60a5fa' },
};

const statusMeta: Record<
  InboxStatus,
  { label: string; color: string }
> = {
  pending: { label: 'Pendente', color: '#3b6cf5' },
  accepted: { label: 'Aceito', color: '#16a34a' },
  rejected: { label: 'Recusado', color: '#dc2626' },
  duplicate: { label: 'Duplicata', color: '#ea580c' },
};

const confidenceMeta: Record<string, string> = {
  high: 'Confiança alta',
  medium: 'Confiança média',
  low: 'Confiança baixa',
};

const InboxCard = forwardRef<HTMLDivElement, InboxCardProps>(function InboxCard(
  {
    item,
    isFocused,
    isReadOnly,
    onFocus,
    onAccept,
    onDuplicate,
    onReject,
    membersById,
    projectsById,
  },
  ref,
) {
  const source = sourceMeta[item.source] || sourceMeta.manual;
  const SourceIcon = source.Icon;
  const ai = item.ai_suggestion ?? null;

  const suggestedAssignee = useMemo(() => {
    if (!ai?.suggested_assignee_id) return null;
    return membersById.get(ai.suggested_assignee_id) ?? null;
  }, [ai?.suggested_assignee_id, membersById]);

  const suggestedProject = useMemo(() => {
    if (!ai?.suggested_project_id) return null;
    return projectsById.get(ai.suggested_project_id) ?? null;
  }, [ai?.suggested_project_id, projectsById]);

  const labels = ai?.suggested_labels ?? [];
  const priority = ai?.priority ? priorityMeta[ai.priority] : null;
  const dupScore =
    typeof ai?.duplicate_score === 'number'
      ? Math.round(ai.duplicate_score * 100)
      : null;
  const status = statusMeta[item.status] ?? statusMeta.pending;

  return (
    <div
      ref={ref}
      role="group"
      tabIndex={0}
      data-inbox-card-id={item.id}
      onFocus={onFocus}
      onClick={onFocus}
      className={cn(
        'card-premium relative grid gap-4 p-4 outline-none transition md:grid-cols-[minmax(0,1fr)_auto]',
        'hover:border-[var(--accent)]/40 focus:border-[var(--accent)]/60',
        isFocused &&
          'border-[var(--accent)]/70 ring-2 ring-[var(--accent)]/30 ring-offset-0',
      )}
    >
      <div className="min-w-0 space-y-2.5">
        {/* Header — source + reporter + time */}
        <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-secondary-muted">
          <span
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-medium"
            style={{ backgroundColor: source.color + '18', color: source.color }}
          >
            <SourceIcon size={11} />
            {source.label}
          </span>
          {item.reporter_name && (
            <span className="inline-flex items-center gap-1 text-text-secondary-muted">
              <AtSign size={11} className="text-tertiary-muted" />
              <span className="text-secondary-muted">{item.reporter_name}</span>
              {item.reporter_email && (
                <span className="text-tertiary-muted">
                  ·{' '}
                  <span className="font-mono text-[11px]">
                    {item.reporter_email}
                  </span>
                </span>
              )}
            </span>
          )}
          <span className="ml-auto text-tertiary-muted">
            {timeAgo(item.created_at)}
          </span>
        </div>

        {/* Title + description */}
        <div className="space-y-1">
          <h3 className="text-[14.5px] font-semibold leading-snug text-primary">
            {item.title}
          </h3>
          {item.description && (
            <p className="line-clamp-3 text-[13px] leading-relaxed text-secondary-muted">
              {item.description}
            </p>
          )}
        </div>

        {/* AI suggestions */}
        {ai && (
          <div className="space-y-2 rounded-md border border-violet-500/15 bg-gradient-to-br from-violet-500/8 to-transparent px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-wider text-violet-500">
                <Sparkles size={11} />
                Sugestão IA
              </span>
              {ai.confidence && confidenceMeta[ai.confidence] && (
                <span className="text-tertiary-muted">
                  · {confidenceMeta[ai.confidence]}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {priority && (
                <span
                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] font-semibold"
                  style={{
                    backgroundColor: priority.color + '20',
                    color: priority.color,
                  }}
                >
                  {priority.label}
                </span>
              )}
              {suggestedProject && (
                <span
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-semibold"
                  style={{
                    backgroundColor: (suggestedProject.color || '#3b6cf5') + '18',
                    color: suggestedProject.color || '#3b6cf5',
                  }}
                >
                  <Hash size={9} />
                  {suggestedProject.name}
                </span>
              )}
              {labels.slice(0, 5).map((lbl) => (
                <span
                  key={lbl}
                  className="inline-flex items-center rounded border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-1.5 py-0.5 text-[10.5px] font-medium text-secondary-muted"
                >
                  {lbl}
                </span>
              ))}
              {suggestedAssignee && (
                <span className="ml-1 inline-flex items-center gap-1 text-[11px] text-secondary-muted">
                  <Avatar
                    name={suggestedAssignee.display_name || 'A'}
                    imageUrl={suggestedAssignee.avatar_url || null}
                    size="xs"
                  />
                  <span className="text-secondary-muted">
                    {suggestedAssignee.display_name}
                  </span>
                </span>
              )}
            </div>

            {/* Duplicate banner */}
            {ai.duplicate_ticket_id && (
              <div className="flex items-start gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11.5px] text-amber-700 dark:text-amber-300">
                <TriangleAlert size={12} className="mt-0.5 shrink-0" />
                <span>
                  Talvez duplicata de{' '}
                  <span className="font-mono font-semibold">
                    {ai.duplicate_ticket_id}
                  </span>
                  {dupScore !== null && (
                    <span className="ml-1 text-amber-600 dark:text-amber-400">
                      (score {dupScore}%)
                    </span>
                  )}
                </span>
              </div>
            )}

            {ai.summary && (
              <p className="text-[12px] leading-relaxed text-secondary-muted">
                <span className="font-semibold text-primary">Resumo: </span>
                {ai.summary}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Action column */}
      <div className="flex flex-row items-stretch gap-1.5 md:flex-col md:items-stretch md:justify-start md:min-w-[140px]">
        {isReadOnly ? (
          <span
            className="inline-flex items-center justify-center gap-1 rounded-md px-3 py-1.5 text-[11.5px] font-semibold"
            style={{
              backgroundColor: status.color + '18',
              color: status.color,
            }}
          >
            {status.label}
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAccept();
              }}
              className="group inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12.5px] font-semibold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
              aria-label="Aceitar (1)"
              title="Aceitar (1)"
            >
              <Check size={13} />
              Aceitar
              <kbd className="ml-1 rounded bg-emerald-600/20 px-1 text-[10px] font-mono text-emerald-700 dark:text-emerald-300">
                1
              </kbd>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              className="group inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12.5px] font-semibold text-amber-700 transition hover:bg-amber-500/20 dark:text-amber-300"
              aria-label="Marcar como duplicata (2)"
              title="Duplicar (2)"
            >
              <TriangleAlert size={13} />
              Duplicar
              <kbd className="ml-1 rounded bg-amber-600/20 px-1 text-[10px] font-mono text-amber-700 dark:text-amber-300">
                2
              </kbd>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReject();
              }}
              className="group inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12.5px] font-semibold text-red-700 transition hover:bg-red-500/20 dark:text-red-300"
              aria-label="Recusar (3)"
              title="Recusar (3)"
            >
              <X size={13} />
              Recusar
              <kbd className="ml-1 rounded bg-red-600/20 px-1 text-[10px] font-mono text-red-700 dark:text-red-300">
                3
              </kbd>
            </button>
          </>
        )}
      </div>
    </div>
  );
});

export default InboxCard;
