import * as React from 'react';
import Link from 'next/link';
import InboxEmpty from './empty-illustrations/InboxEmpty';
import TicketsEmpty from './empty-illustrations/TicketsEmpty';
import NoResultsEmpty from './empty-illustrations/NoResultsEmpty';
import NoProjectsEmpty from './empty-illustrations/NoProjectsEmpty';
import AllDoneEmpty from './empty-illustrations/AllDoneEmpty';
import NoActivityEmpty from './empty-illustrations/NoActivityEmpty';

export type EmptyIllustration =
  | 'inbox'
  | 'tickets'
  | 'no-results'
  | 'no-projects'
  | 'all-done'
  | 'no-activity';

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'secondary';
}

/**
 * Lucide-style icon component (e.g. `Inbox` from `lucide-react`).
 * Kept loose to avoid a hard dependency on the library's type signature.
 */
type IconComponent = React.ComponentType<{ size?: number | string; className?: string }>;

export interface EmptyStateProps {
  /**
   * Either a Lucide-style icon component (`Inbox`, `Sparkles`, …) or any
   * pre-rendered ReactNode (custom SVG, image, etc.). Ignored when
   * `illustration` is set.
   */
  icon?: IconComponent | React.ReactNode;
  /**
   * Built-in inline illustration. Takes precedence over `icon`.
   */
  illustration?: EmptyIllustration;
  title: string;
  description?: string;
  /**
   * One or more call-to-action buttons / links.
   */
  actions?: EmptyStateAction[];
  /**
   * Backward-compatible single action (older call sites). Prefer `actions`.
   */
  action?: { label: string; onClick: () => void };
  className?: string;
}

const ILLUSTRATIONS: Record<EmptyIllustration, React.ComponentType<{ className?: string }>> = {
  inbox: InboxEmpty,
  tickets: TicketsEmpty,
  'no-results': NoResultsEmpty,
  'no-projects': NoProjectsEmpty,
  'all-done': AllDoneEmpty,
  'no-activity': NoActivityEmpty,
};

function isIconComponent(value: unknown): value is IconComponent {
  return typeof value === 'function';
}

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Centered empty-state block with optional inline illustration, title,
 * description, and one or more actions (buttons or links).
 *
 * Backward compatible with the previous `{ icon: LucideIcon, action }` API.
 *
 * @example
 * // Em /inbox vazio
 * <EmptyState
 *   illustration="inbox"
 *   title="Caixa de entrada vazia"
 *   description="Tudo triado! Quando chegarem novos itens, eles aparecem aqui."
 *   actions={[{ label: 'Configurar webhooks', href: '/settings/webhooks', variant: 'secondary' }]}
 * />
 *
 * @example
 * // Em /my-tasks sem tickets
 * <EmptyState
 *   illustration="all-done"
 *   title="Nada urgente"
 *   description="Você não tem tarefas atrasadas ou para hoje."
 * />
 *
 * @example
 * // Em busca sem resultados
 * <EmptyState illustration="no-results" title="Nenhum resultado" />
 */
export default function EmptyState({
  icon,
  illustration,
  title,
  description,
  actions,
  action,
  className,
}: EmptyStateProps): JSX.Element {
  const Illustration = illustration ? ILLUSTRATIONS[illustration] : null;

  // Merge legacy `action` into `actions` so both APIs work.
  const resolvedActions: EmptyStateAction[] = React.useMemo(() => {
    const list: EmptyStateAction[] = [];
    if (actions && actions.length > 0) list.push(...actions);
    if (action) list.push({ label: action.label, onClick: action.onClick, variant: 'primary' });
    return list;
  }, [actions, action]);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-6 text-center',
        className,
      )}
    >
      {Illustration ? (
        <div className="mb-5 text-tertiary-muted" aria-hidden="true">
          <Illustration className="h-32 w-40 sm:h-36 sm:w-44" />
        </div>
      ) : icon ? (
        <div
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--overlay-subtle)] text-secondary-muted"
          aria-hidden="true"
        >
          {isIconComponent(icon) ? React.createElement(icon, { size: 24 }) : icon}
        </div>
      ) : null}

      <h3 className="text-base font-semibold text-primary">{title}</h3>

      {description && (
        <p className="mt-1.5 max-w-md text-sm text-secondary-muted">{description}</p>
      )}

      {resolvedActions.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {resolvedActions.map((a, idx) => {
            const variant: 'primary' | 'secondary' = a.variant ?? (idx === 0 ? 'primary' : 'secondary');
            const baseClasses = cn(
              'inline-flex items-center justify-center rounded-md px-4 py-2 text-xs font-medium transition',
              variant === 'primary'
                ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
                : 'border border-[var(--card-border)] text-primary hover:bg-[var(--overlay-hover)]',
            );

            if (a.href) {
              return (
                <Link
                  key={`${a.label}-${idx}`}
                  href={a.href as Parameters<typeof Link>[0]['href']}
                  className={baseClasses}
                >
                  {a.label}
                </Link>
              );
            }
            return (
              <button
                key={`${a.label}-${idx}`}
                type="button"
                onClick={a.onClick}
                className={baseClasses}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
