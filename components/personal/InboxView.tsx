'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell, Check, AtSign, MessageSquare, AlertCircle, UserPlus } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title?: string | null;
  message: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
  actor_name?: string | null;
  entity_type?: string | null;
}

function getIcon(type: string) {
  if (type.includes('mention')) return AtSign;
  if (type.includes('comment')) return MessageSquare;
  if (type.includes('assign')) return UserPlus;
  if (type.includes('alert')) return AlertCircle;
  return Bell;
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d`;
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function InboxView() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  async function load() {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) setNotifications(await res.json());
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function markAllRead() {
    await fetch('/api/notifications', { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications?id=${id}`, { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }

  const filtered = notifications.filter((n) => (filter === 'unread' ? !n.is_read : true));
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-md px-3 py-1.5 text-[12.5px] font-medium transition ${
              filter === 'all' ? 'bg-[var(--card-hover)] text-primary' : 'text-secondary hover:text-primary'
            }`}
          >
            Todas
            <span className="ml-1.5 text-[10px] tabular-nums text-[var(--text-tertiary)]">
              {notifications.length}
            </span>
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`rounded-md px-3 py-1.5 text-[12.5px] font-medium transition ${
              filter === 'unread' ? 'bg-[var(--card-hover)] text-primary' : 'text-secondary hover:text-primary'
            }`}
          >
            Não lidas
            {unreadCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-[var(--accent)]/20 px-1.5 py-px text-[10px] tabular-nums text-[var(--accent)]">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-premium btn-secondary text-[12px]">
            <Check size={12} /> Marcar todas como lidas
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card-premium p-10 text-center">
          <Bell size={28} strokeWidth={1.5} className="mx-auto text-[var(--text-tertiary)]" />
          <p className="mt-3 text-[14px] text-secondary">
            {filter === 'unread' ? 'Nenhuma notificação não lida.' : 'Sua caixa está vazia.'}
          </p>
          <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">
            Você verá aqui menções e atualizações de tickets.
          </p>
        </div>
      ) : (
        <div className="card-premium overflow-hidden">
          {filtered.map((n) => {
            const Icon = getIcon(n.type);
            const content = (
              <div
                className={`grid grid-cols-[28px_1fr_auto] items-start gap-3 border-b border-[var(--card-border)] px-4 py-3 last:border-0 hover:bg-[var(--overlay-subtle)] transition-colors ${
                  !n.is_read ? 'bg-[var(--accent)]/5' : ''
                }`}
              >
                <div className="flex items-center justify-center pt-0.5">
                  <Icon size={14} className={n.is_read ? 'text-[var(--text-tertiary)]' : 'text-[var(--accent)]'} />
                </div>
                <div className="min-w-0">
                  <p className={`text-[13px] leading-snug ${n.is_read ? 'text-secondary' : 'text-primary font-medium'}`}>
                    {n.title && <span className="font-semibold">{n.title}: </span>}
                    {n.message}
                  </p>
                  {n.actor_name && (
                    <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">por {n.actor_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] tabular-nums text-[var(--text-tertiary)]">{timeAgo(n.created_at)}</span>
                  {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
                </div>
              </div>
            );
            return n.link ? (
              <Link key={n.id} href={n.link as any} onClick={() => !n.is_read && markRead(n.id)} className="block">
                {content}
              </Link>
            ) : (
              <button key={n.id} onClick={() => !n.is_read && markRead(n.id)} className="block w-full text-left">
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
