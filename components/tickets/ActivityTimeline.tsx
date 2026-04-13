'use client';

import { useState, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useActivityLog } from '@/lib/hooks/useActivityLog';
import QuickReactions from './QuickReactions';
import CommentReactions from './CommentReactions';
import { cn } from '@/lib/utils/cn';

interface Comment {
  id: string;
  body: string;
  created_at: string;
  author_name: string;
  author_email: string;
}

type TabKey = 'all' | 'comments' | 'history' | 'activity' | 'time_status';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'Tudo' },
  { key: 'comments', label: 'Comentários' },
  { key: 'history', label: 'Histórico' },
  { key: 'activity', label: 'Reg. Atividades' },
  { key: 'time_status', label: 'Time in Status' },
];

interface ActivityTimelineProps {
  ticketId: string;
}

export default function ActivityTimeline({ ticketId }: ActivityTimelineProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { activities } = useActivityLog(ticketId);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?ticket_id=${ticketId}`);
      if (res.ok) setComments(await res.json());
    } catch { /* silencioso */ }
  }, [ticketId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  async function submitComment(text: string) {
    if (!text.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId, content: text.trim() }),
      });
      if (res.ok) {
        setNewComment('');
        await fetchComments();
      }
    } catch { /* silencioso */ }
    finally { setIsSubmitting(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitComment(newComment);
  }

  function timeAgo(dateStr: string) {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR });
    } catch { return dateStr; }
  }

  function getInitials(name: string) {
    return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
  }

  // Combinar e ordenar para a aba "Tudo"
  const allItems = [
    ...comments.map((c) => ({ type: 'comment' as const, date: c.created_at, data: c })),
    ...activities.map((a) => ({ type: 'activity' as const, date: a.created_at, data: a })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calcular time in status
  const statusTimes = activities
    .filter((a) => a.field_name === 'status')
    .reduce<Record<string, number>>((acc, a, idx, arr) => {
      const statusName = a.old_value || 'Desconhecido';
      const from = idx + 1 < arr.length ? new Date(arr[idx + 1].created_at) : new Date(a.created_at);
      const to = new Date(a.created_at);
      const minutes = Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
      acc[statusName] = (acc[statusName] || 0) + minutes;
      return acc;
    }, {});

  function renderComment(c: Comment) {
    return (
      <div key={c.id} className="flex gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
          {getInitials(c.author_name)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-200">{c.author_name}</span>
            <span className="text-[10px] text-slate-600">{timeAgo(c.created_at)}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-400">{c.body}</p>
          <CommentReactions commentId={c.id} />
        </div>
      </div>
    );
  }

  function renderActivity(a: typeof activities[0]) {
    return (
      <div key={a.id} className="flex items-start gap-2 text-xs">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[9px] text-slate-400">
          {a.actor_name ? getInitials(a.actor_name) : '?'}
        </div>
        <div className="flex-1">
          <span className="text-slate-400">
            {a.actor_name && <span className="font-medium text-slate-300">{a.actor_name}</span>}
            {' '}alterou <span className="font-medium text-slate-300">{a.field_name}</span>
            {a.old_value && <> de <span className="line-through text-slate-500">{a.old_value}</span></>}
            {' '}para <span className="font-medium text-white">{a.new_value}</span>
          </span>
          <span className="ml-2 text-[10px] text-slate-600">{timeAgo(a.created_at)}</span>
        </div>
      </div>
    );
  }

  function formatMin(m: number): string {
    if (m < 60) return `${m}min`;
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest > 0 ? `${h}h ${rest}min` : `${h}h`;
  }

  return (
    <section className="rounded-lg border border-border/40 bg-surface2 p-5">
      {/* Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border/30 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'whitespace-nowrap rounded-t px-3 py-1.5 text-[11px] font-medium transition',
              activeTab === tab.key
                ? 'bg-accent/15 text-accent'
                : 'text-slate-500 hover:text-slate-300'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="max-h-[500px] space-y-3 overflow-auto">
        {activeTab === 'all' && allItems.map((item) =>
          item.type === 'comment'
            ? renderComment(item.data as Comment)
            : renderActivity(item.data as typeof activities[0])
        )}

        {activeTab === 'comments' && (
          comments.length > 0
            ? comments.map(renderComment)
            : <p className="text-xs italic text-slate-600">Nenhum comentário.</p>
        )}

        {activeTab === 'history' && (
          activities.filter((a) => a.field_name === 'status' || a.field_name === 'assignee').length > 0
            ? activities
                .filter((a) => a.field_name === 'status' || a.field_name === 'assignee')
                .map(renderActivity)
            : <p className="text-xs italic text-slate-600">Nenhuma mudança registrada.</p>
        )}

        {activeTab === 'activity' && (
          activities.length > 0
            ? activities.map(renderActivity)
            : <p className="text-xs italic text-slate-600">Nenhuma atividade registrada.</p>
        )}

        {activeTab === 'time_status' && (
          Object.keys(statusTimes).length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="pb-1 text-left font-medium text-slate-500">Status</th>
                  <th className="pb-1 text-right font-medium text-slate-500">Tempo</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(statusTimes).map(([status, mins]) => (
                  <tr key={status} className="border-b border-border/20">
                    <td className="py-1.5 text-slate-300">{status}</td>
                    <td className="py-1.5 text-right font-medium text-slate-400">{formatMin(mins)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-xs italic text-slate-600">Nenhum dado de tempo.</p>
        )}
      </div>

      {/* Comment input + quick reactions */}
      <div className="mt-4 space-y-2 border-t border-border/30 pt-4">
        <QuickReactions onReact={(text) => submitComment(text)} />
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Adicionar comentário... (aperte M para focar)"
            className="flex-1 rounded-md border border-border/40 bg-surface px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 transition focus:border-accent/60"
          />
          <button
            type="submit"
            disabled={isSubmitting || !newComment.trim()}
            className="rounded-md bg-accent px-3 py-2 text-white transition hover:bg-blue-500 disabled:opacity-40"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </section>
  );
}
