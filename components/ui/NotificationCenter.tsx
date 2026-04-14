'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils/cn';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
  ticket_id: string | null;
  actor_name: string | null;
  ticket_key: string | null;
}

export default function NotificationCenter() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) setNotifications(await res.json());
    } catch (err) { console.error('Erro ao carregar notificações:', err); }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'read_all' }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function handleClick(n: Notification) {
    if (!n.is_read) {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: n.id }),
      });
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
    }
    if (n.ticket_id) {
      setIsOpen(false);
      router.push(`/ticket/${n.ticket_id}`);
    }
  }

  function timeAgo(dateStr: string) {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR });
    } catch { return dateStr; }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-md p-1.5 text-slate-500 transition hover:bg-input/40 hover:text-slate-300"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-border/60 bg-surface2 shadow-2xl shadow-black/30 animate-slide-down z-50">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-2.5">
            <h3 className="text-xs font-semibold text-slate-200">Notificações</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[10px] text-accent hover:text-blue-400"
                >
                  <Check size={11} />
                  Marcar todas
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-slate-300">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Nenhuma notificação
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    'flex w-full gap-3 px-4 py-3 text-left transition hover:bg-surface',
                    !n.is_read && 'bg-accent/5'
                  )}
                >
                  {!n.is_read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  )}
                  <div className={cn('flex-1 min-w-0', n.is_read && 'ml-5')}>
                    <p className="text-xs font-medium text-slate-200">{n.title}</p>
                    {n.message && (
                      <p className="mt-0.5 truncate text-[11px] text-slate-400">{n.message}</p>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                      {n.ticket_key && <span className="font-mono">{n.ticket_key}</span>}
                      {n.actor_name && <span>{n.actor_name}</span>}
                      <span>{timeAgo(n.created_at)}</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
