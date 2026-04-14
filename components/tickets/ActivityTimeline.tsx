'use client';

import { useState, useEffect, useCallback } from 'react';
import { Send, Reply, ThumbsUp, Smile, Pencil, Trash2 } from 'lucide-react';
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
  { key: 'activity', label: 'Registro de atividades' },
  { key: 'time_status', label: 'Time in Status' },
];

interface ActivityTimelineProps {
  ticketId: string;
}

export default function ActivityTimeline({ ticketId }: ActivityTimelineProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('comments');
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const { activities } = useActivityLog(ticketId);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?ticket_id=${ticketId}`);
      if (res.ok) setComments(await res.json());
    } catch (err) { console.error('Erro ao carregar comentários:', err); }
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
    } catch (err) { console.error('Erro ao enviar comentário:', err); }
    finally { setIsSubmitting(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitComment(newComment);
  }

  async function handleEditComment(id: string, body: string) {
    try {
      const res = await fetch('/api/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, content: body }),
      });
      if (res.ok) {
        setEditingId(null);
        await fetchComments();
      }
    } catch (err) { console.error('Erro ao editar comentário:', err); }
  }

  async function handleDeleteComment(id: string) {
    if (!confirm('Remover este comentário?')) return;
    try {
      const res = await fetch(`/api/comments?id=${id}`, { method: 'DELETE' });
      if (res.ok) await fetchComments();
    } catch (err) { console.error('Erro ao deletar comentário:', err); }
  }

  function timeAgo(dateStr: string) {
    try { return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR }); }
    catch { return dateStr; }
  }

  function formatDate(dateStr: string) {
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch { return dateStr; }
  }

  function getInitials(name: string) {
    return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
  }

  const allItems = [
    ...comments.map((c) => ({ type: 'comment' as const, date: c.created_at, data: c })),
    ...activities.map((a) => ({ type: 'activity' as const, date: a.created_at, data: a })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
    const isEditing = editingId === c.id;

    return (
      <div key={c.id} className="group flex gap-3 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-600 to-orange-700 text-[10px] font-bold text-white">
          {getInitials(c.author_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-slate-200">{c.author_name}</span>
            <span className="text-[11px] text-slate-500">{formatDate(c.created_at)}</span>
          </div>
          {isEditing ? (
            <div className="mt-1 space-y-2">
              <input
                autoFocus
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleEditComment(c.id, editBody); if (e.key === 'Escape') setEditingId(null); }}
                className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-slate-200 outline-none focus:border-blue-500/30"
              />
              <div className="flex gap-2">
                <button onClick={() => handleEditComment(c.id, editBody)} className="rounded bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-500">Salvar</button>
                <button onClick={() => setEditingId(null)} className="text-[11px] text-slate-500 hover:text-slate-300">Cancelar</button>
              </div>
            </div>
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-slate-300">{c.body}</p>
          )}
          <CommentReactions commentId={c.id} />
          {/* Comment actions */}
          {!isEditing && (
            <div className="mt-1.5 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
              <button className="rounded p-1 text-slate-500 hover:bg-white/[0.06] hover:text-slate-300" title="Responder"><Reply size={13} /></button>
              <button className="rounded p-1 text-slate-500 hover:bg-white/[0.06] hover:text-slate-300" title="Curtir"><ThumbsUp size={13} /></button>
              <button className="rounded p-1 text-slate-500 hover:bg-white/[0.06] hover:text-slate-300" title="Reação"><Smile size={13} /></button>
              <button onClick={() => { setEditingId(c.id); setEditBody(c.body); }} className="rounded p-1 text-slate-500 hover:bg-white/[0.06] hover:text-slate-300" title="Editar"><Pencil size={13} /></button>
              <button onClick={() => handleDeleteComment(c.id)} className="rounded p-1 text-slate-500 hover:bg-white/[0.06] hover:text-red-400" title="Remover"><Trash2 size={13} /></button>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderActivity(a: typeof activities[0]) {
    return (
      <div key={a.id} className="flex items-start gap-3 py-2.5 text-[13px]">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[8px] font-bold text-slate-400">
          {a.actor_name ? getInitials(a.actor_name) : '?'}
        </div>
        <div className="flex-1 text-slate-400">
          {a.actor_name && <span className="font-medium text-slate-300">{a.actor_name}</span>}
          {' '}alterou <span className="font-medium text-slate-300">{a.field_name}</span>
          {a.old_value && <> de <span className="line-through text-slate-500">{a.old_value}</span></>}
          {' '}para <span className="font-medium text-white">{a.new_value}</span>
          <span className="ml-2 text-[11px] text-slate-600">{timeAgo(a.created_at)}</span>
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
    <div>
      {/* Tabs — pill style like Jira */}
      <div className="mb-4 flex items-center gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'rounded-full px-3 py-1 text-[12px] font-medium transition',
              activeTab === tab.key
                ? 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30'
                : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Comment input + quick reactions */}
      <div className="mb-4">
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-[10px] font-bold text-white">
            PV
          </div>
          <form onSubmit={handleSubmit} className="flex-1">
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Adicionar comentário..."
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-[13px] text-slate-200 outline-none placeholder:text-slate-600 transition focus:border-blue-500/30 focus:bg-white/[0.05]"
            />
          </form>
        </div>
        <div className="mt-2 ml-11">
          <QuickReactions onReact={(text) => submitComment(text)} />
        </div>
        <p className="mt-2 ml-11 text-[11px] text-slate-600">
          Dica de ouro: aperte <kbd className="rounded border border-white/[0.08] bg-white/[0.04] px-1 py-0.5 text-[10px]">M</kbd> para fazer comentários
        </p>
      </div>

      {/* Content */}
      <div className="divide-y divide-white/[0.04]">
        {activeTab === 'all' && allItems.map((item) =>
          item.type === 'comment'
            ? renderComment(item.data as Comment)
            : renderActivity(item.data as typeof activities[0])
        )}

        {activeTab === 'comments' && (
          comments.length > 0
            ? comments.map(renderComment)
            : <p className="py-6 text-center text-[13px] text-slate-600">Nenhum comentário ainda.</p>
        )}

        {activeTab === 'history' && (
          activities.filter((a) => a.field_name === 'status' || a.field_name === 'assignee').length > 0
            ? activities.filter((a) => a.field_name === 'status' || a.field_name === 'assignee').map(renderActivity)
            : <p className="py-6 text-center text-[13px] text-slate-600">Nenhuma mudança registrada.</p>
        )}

        {activeTab === 'activity' && (
          activities.length > 0
            ? activities.map(renderActivity)
            : <p className="py-6 text-center text-[13px] text-slate-600">Nenhuma atividade registrada.</p>
        )}

        {activeTab === 'time_status' && (
          Object.keys(statusTimes).length > 0 ? (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="py-2 text-left font-medium text-slate-500">Status</th>
                  <th className="py-2 text-right font-medium text-slate-500">Tempo</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(statusTimes).map(([status, mins]) => (
                  <tr key={status} className="border-b border-white/[0.04]">
                    <td className="py-2 text-slate-300">{status}</td>
                    <td className="py-2 text-right font-medium text-slate-400">{formatMin(mins)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="py-6 text-center text-[13px] text-slate-600">Nenhum dado de tempo.</p>
        )}
      </div>
    </div>
  );
}
