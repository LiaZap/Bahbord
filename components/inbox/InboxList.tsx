'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Inbox as InboxIcon, RefreshCw } from 'lucide-react';
import { CardSkeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import InboxCard from './InboxCard';
import InboxAcceptModal from './InboxAcceptModal';
import InboxDuplicateModal from './InboxDuplicateModal';
import InboxRejectModal from './InboxRejectModal';
import type { InboxItem, InboxListResponse, OptionItem } from './types';

type Tab = 'pending' | 'recent';
type ModalKind = null | 'accept' | 'duplicate' | 'reject';

const RECENT_STATUSES = ['accepted', 'rejected', 'duplicate'] as const;

export default function InboxList() {
  const [tab, setTab] = useState<Tab>('pending');
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  // Option lists shared by modals
  const [projects, setProjects] = useState<OptionItem[]>([]);
  const [members, setMembers] = useState<OptionItem[]>([]);
  const [ticketTypes, setTicketTypes] = useState<OptionItem[]>([]);
  const [statuses, setStatuses] = useState<OptionItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const membersById = useMemo(() => {
    const m = new Map<string, OptionItem>();
    for (const x of members) m.set(x.id, x);
    return m;
  }, [members]);

  const projectsById = useMemo(() => {
    const m = new Map<string, OptionItem>();
    for (const x of projects) m.set(x.id, x);
    return m;
  }, [projects]);

  // Load options once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pr, mb, tt, st] = await Promise.all([
          fetch('/api/options?type=projects'),
          fetch('/api/options?type=members'),
          fetch('/api/options?type=ticket_types'),
          fetch('/api/options?type=statuses'),
        ]);
        if (cancelled) return;
        if (pr.ok) setProjects(await pr.json());
        if (mb.ok) setMembers(await mb.json());
        if (tt.ok) setTicketTypes(await tt.json());
        if (st.ok) setStatuses(await st.json());
      } catch {
        // silencioso — modais funcionam mesmo se opções falharem
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadItems = useCallback(
    async (currentTab: Tab, isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        if (currentTab === 'pending') {
          const res = await fetch('/api/inbox?status=pending&limit=100');
          if (!res.ok) {
            setItems([]);
            return;
          }
          const data = (await res.json()) as InboxListResponse;
          setItems(data.data || []);
          setPendingCount(data.pagination?.total ?? data.data?.length ?? 0);
        } else {
          // Triados recentes — buscamos all e filtramos client-side pelos não-pending
          const res = await fetch('/api/inbox?status=all&limit=100');
          if (!res.ok) {
            setItems([]);
            return;
          }
          const data = (await res.json()) as InboxListResponse;
          const all = data.data || [];
          setItems(
            all.filter((i) =>
              (RECENT_STATUSES as readonly string[]).includes(i.status),
            ),
          );
          // Se ainda não temos pending count, pega em paralelo
          const pendingItems = all.filter((i) => i.status === 'pending');
          setPendingCount(pendingItems.length);
        }
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadItems(tab);
  }, [tab, loadItems]);

  // Focus first card when items load
  useEffect(() => {
    if (items.length === 0) {
      setFocusedId(null);
      return;
    }
    if (!focusedId || !items.some((i) => i.id === focusedId)) {
      setFocusedId(items[0].id);
    }
  }, [items, focusedId]);

  // Auto-focus DOM node when focusedId changes
  useEffect(() => {
    if (!focusedId) return;
    const el = cardRefs.current.get(focusedId);
    if (el && document.activeElement !== el) {
      // Sem scroll abrupto; apenas se necessário
      el.focus({ preventScroll: false });
    }
  }, [focusedId]);

  const openModal = useCallback((kind: Exclude<ModalKind, null>, id: string) => {
    setActiveItemId(id);
    setModal(kind);
  }, []);

  const closeModal = useCallback(() => {
    setModal(null);
    setActiveItemId(null);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setPendingCount((c) => Math.max(0, c - 1));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isInput =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isInput) return;
      if (modal !== null) return; // modais lidam com seus próprios shortcuts (Esc via Modal)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (items.length === 0) return;

      // Navigation
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedId((cur) => {
          const idx = cur ? items.findIndex((i) => i.id === cur) : -1;
          const next = items[Math.min(items.length - 1, idx + 1)];
          return next ? next.id : cur;
        });
        return;
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedId((cur) => {
          const idx = cur ? items.findIndex((i) => i.id === cur) : 0;
          const prev = items[Math.max(0, idx - 1)];
          return prev ? prev.id : cur;
        });
        return;
      }

      // Actions only on pending
      if (tab !== 'pending') return;
      if (!focusedId) return;
      if (e.key === '1') {
        e.preventDefault();
        openModal('accept', focusedId);
      } else if (e.key === '2') {
        e.preventDefault();
        openModal('duplicate', focusedId);
      } else if (e.key === '3') {
        e.preventDefault();
        openModal('reject', focusedId);
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [items, focusedId, modal, tab, openModal]);

  const activeItem = useMemo(
    () => items.find((i) => i.id === activeItemId) || null,
    [items, activeItemId],
  );

  const showLoading = loading;

  return (
    <div className="space-y-5">
      {/* Tabs + actions */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label="Filtros da triagem"
          className="inline-flex rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] p-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'pending'}
            onClick={() => setTab('pending')}
            className={
              tab === 'pending'
                ? 'rounded px-3 py-1.5 text-[12.5px] font-semibold text-primary bg-[var(--card-bg)] shadow-sm'
                : 'rounded px-3 py-1.5 text-[12.5px] font-medium text-secondary-muted hover:text-primary'
            }
          >
            Pendentes
            {pendingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-[var(--accent)]/20 px-1.5 py-px text-[10px] tabular-nums text-[var(--accent)]">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'recent'}
            onClick={() => setTab('recent')}
            className={
              tab === 'recent'
                ? 'rounded px-3 py-1.5 text-[12.5px] font-semibold text-primary bg-[var(--card-bg)] shadow-sm'
                : 'rounded px-3 py-1.5 text-[12.5px] font-medium text-secondary-muted hover:text-primary'
            }
          >
            Triados (recentes)
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadItems(tab, true)}
            disabled={refreshing}
            className="btn-premium btn-ghost text-[12px]"
            aria-label="Recarregar lista"
          >
            <RefreshCw
              size={12}
              className={refreshing ? 'animate-spin' : ''}
            />
            Atualizar
          </button>
          {tab === 'pending' && items.length > 0 && (
            <span className="hidden text-[11px] text-tertiary-muted sm:inline">
              <kbd className="rounded border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-1 font-mono">
                j
              </kbd>{' '}
              /{' '}
              <kbd className="rounded border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-1 font-mono">
                k
              </kbd>{' '}
              navegar ·{' '}
              <kbd className="rounded border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-1 font-mono">
                1
              </kbd>{' '}
              <kbd className="rounded border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-1 font-mono">
                2
              </kbd>{' '}
              <kbd className="rounded border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-1 font-mono">
                3
              </kbd>{' '}
              agir
            </span>
          )}
        </div>
      </div>

      {/* List */}
      {showLoading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title={
            tab === 'pending'
              ? 'Nenhum item pendente — tudo limpo!'
              : 'Nenhum item triado recentemente'
          }
          description={
            tab === 'pending'
              ? 'Novas mensagens do Slack, e-mails e links públicos vão aparecer aqui para triagem.'
              : 'Quando você aceitar, recusar ou marcar duplicatas, o histórico aparece aqui.'
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <InboxCard
              key={item.id}
              ref={(el) => {
                if (el) cardRefs.current.set(item.id, el);
                else cardRefs.current.delete(item.id);
              }}
              item={item}
              isFocused={focusedId === item.id}
              isReadOnly={tab !== 'pending' || item.status !== 'pending'}
              onFocus={() => setFocusedId(item.id)}
              onAccept={() => openModal('accept', item.id)}
              onDuplicate={() => openModal('duplicate', item.id)}
              onReject={() => openModal('reject', item.id)}
              membersById={membersById}
              projectsById={projectsById}
            />
          ))}
        </div>
      )}

      <InboxAcceptModal
        item={modal === 'accept' ? activeItem : null}
        isOpen={modal === 'accept'}
        onClose={closeModal}
        onAccepted={(id) => removeItem(id)}
        projects={projects}
        members={members}
        ticketTypes={ticketTypes}
        statuses={statuses}
      />
      <InboxDuplicateModal
        item={modal === 'duplicate' ? activeItem : null}
        isOpen={modal === 'duplicate'}
        onClose={closeModal}
        onMarked={(id) => removeItem(id)}
      />
      <InboxRejectModal
        item={modal === 'reject' ? activeItem : null}
        isOpen={modal === 'reject'}
        onClose={closeModal}
        onRejected={(id) => removeItem(id)}
      />
    </div>
  );
}
