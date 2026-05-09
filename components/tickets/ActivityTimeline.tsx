'use client';

import { useState } from 'react';
import { Reply, ThumbsUp, Smile, Pencil, Trash2, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useActivityLog } from '@/lib/hooks/useActivityLog';
import { useComments } from '@/lib/hooks/useComments';
import QuickReactions from './QuickReactions';
import CommentReactions from './CommentReactions';
import MentionInput from './MentionInput';
import Avatar from '@/components/ui/Avatar';
import { cn } from '@/lib/utils/cn';
import { useUser } from '@clerk/nextjs';
import { useConfirm } from '@/components/ui/ConfirmModal';

interface Comment {
  id: string;
  body: string;
  created_at: string;
  author_name: string;
  author_email: string;
  author_avatar: string | null;
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
  const [newComment, setNewComment] = useState('');
  const [pastedImageData, setPastedImageData] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);
  const { activities } = useActivityLog(ticketId);
  const { comments, isSubmitting, submitComment: rawSubmitComment, editComment, deleteComment } = useComments(ticketId);
  const { user } = useUser();
  const { confirm } = useConfirm();

  async function submitComment(text: string) {
    let commentBody = text;
    if (pastedImageData) {
      // Replace placeholder with actual inline image HTML
      commentBody = commentBody.replace(
        '📷 [imagem colada]',
        ''
      ).trim();
      const imgTag = `<img src="${pastedImageData}" alt="Imagem colada" style="max-width:100%;border-radius:8px;margin-top:4px;" />`;
      commentBody = commentBody ? `${commentBody}\n${imgTag}` : imgTag;
    }
    await rawSubmitComment(commentBody);
    setNewComment('');
    setPastedImageData(null);
  }

  async function handleEditComment(id: string, body: string) {
    const ok = await editComment(id, body);
    if (ok) setEditingId(null);
  }

  async function handleDeleteComment(id: string) {
    const ok = await confirm({
      title: 'Remover comentário',
      message: 'Tem certeza que deseja remover este comentário? Esta ação não pode ser desfeita.',
      confirmText: 'Remover',
      variant: 'danger',
    });
    if (ok) await deleteComment(id);
  }

  async function handleSummarizeThread() {
    setAiSummaryError(null);
    setAiSummaryLoading(true);
    try {
      const res = await fetch('/api/ai/summarize-thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAiSummaryError(data?.error || 'Erro ao gerar resumo');
        return;
      }
      const data = await res.json();
      if (!data.summary) {
        setAiSummaryError('Não há comentários para resumir.');
        return;
      }
      setAiSummary(data.summary);
    } catch {
      setAiSummaryError('Erro de conexão ao gerar resumo');
    } finally {
      setAiSummaryLoading(false);
    }
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

  function renderMentions(text: string): React.ReactNode {
    const regex = /@([\w][\w\s]*?[\w])(?=\s|$|[.,!?;:])/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      parts.push(
        <span key={match.index} className="text-blue-400 font-medium">
          @{match[1]}
        </span>
      );
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    return parts.length > 0 ? parts : text;
  }

  function renderComment(c: Comment) {
    const isEditing = editingId === c.id;

    return (
      <div key={c.id} className="group flex gap-3 py-4">
        <Avatar name={c.author_name} imageUrl={c.author_avatar} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-primary">{c.author_name}</span>
            <span className="text-[11px] text-secondary-muted">{formatDate(c.created_at)}</span>
          </div>
          {isEditing ? (
            <div className="mt-1 space-y-2">
              <input
                autoFocus
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleEditComment(c.id, editBody); if (e.key === 'Escape') setEditingId(null); }}
                className="w-full rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-3 py-2 text-[13px] text-primary outline-none focus:border-blue-500/30"
              />
              <div className="flex gap-2">
                <button onClick={() => handleEditComment(c.id, editBody)} className="rounded bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-500">Salvar</button>
                <button onClick={() => setEditingId(null)} className="text-[11px] text-secondary-muted hover:text-primary">Cancelar</button>
              </div>
            </div>
          ) : c.body.includes('<img ') ? (
            <div
              className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-primary [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-1"
              dangerouslySetInnerHTML={{ __html: c.body }}
            />
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-primary">{renderMentions(c.body)}</p>
          )}
          <CommentReactions commentId={c.id} />
          {/* Comment actions */}
          {!isEditing && (
            <div className="mt-1.5 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
              <button className="rounded p-1 text-secondary-muted hover:bg-[var(--overlay-hover)] hover:text-primary" title="Responder" aria-label="Responder"><Reply size={13} /></button>
              <button className="rounded p-1 text-secondary-muted hover:bg-[var(--overlay-hover)] hover:text-primary" title="Curtir" aria-label="Curtir"><ThumbsUp size={13} /></button>
              <button className="rounded p-1 text-secondary-muted hover:bg-[var(--overlay-hover)] hover:text-primary" title="Reação" aria-label="Reação"><Smile size={13} /></button>
              <button onClick={() => { setEditingId(c.id); setEditBody(c.body); }} className="rounded p-1 text-secondary-muted hover:bg-[var(--overlay-hover)] hover:text-primary" title="Editar" aria-label="Editar"><Pencil size={13} /></button>
              <button onClick={() => handleDeleteComment(c.id)} className="rounded p-1 text-secondary-muted hover:bg-[var(--overlay-hover)] hover:text-red-400" title="Remover" aria-label="Remover"><Trash2 size={13} /></button>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderActivity(a: typeof activities[0]) {
    return (
      <div key={a.id} className="flex items-start gap-3 py-2.5 text-[13px]">
        <Avatar name={a.actor_name || '?'} size="sm" />
        <div className="flex-1 text-secondary-muted">
          {a.actor_name && <span className="font-medium text-primary">{a.actor_name}</span>}
          {' '}alterou <span className="font-medium text-primary">{a.field_name}</span>
          {a.old_value && <> de <span className="line-through text-secondary-muted">{a.old_value}</span></>}
          {' '}para <span className="font-medium text-primary">{a.new_value}</span>
          <span className="ml-2 text-[11px] text-tertiary-muted">{timeAgo(a.created_at)}</span>
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
                : 'text-secondary-muted hover:bg-[var(--overlay-hover)] hover:text-primary'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Comment input + quick reactions */}
      <div className="mb-4">
        <div className="flex gap-3">
          <Avatar name={user?.fullName || 'Eu'} imageUrl={user?.imageUrl} size="md" />
          <div className="flex-1">
            <MentionInput
              value={newComment}
              onChange={setNewComment}
              onSubmit={() => submitComment(newComment)}
              onImagePaste={(base64) => setPastedImageData(base64)}
              placeholder="Adicionar comentário... (Ctrl+V para colar imagem)"
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-4 py-2.5 text-[13px] text-primary outline-none placeholder:text-tertiary-muted transition focus:border-blue-500/30 focus:bg-[var(--overlay-hover)]"
            />
          </div>
        </div>
        <div className="mt-2 ml-11">
          <QuickReactions onReact={(text) => submitComment(text)} />
        </div>
        <p className="mt-2 ml-11 text-[11px] text-tertiary-muted">
          Dica de ouro: aperte <kbd className="rounded border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-1 py-0.5 text-[10px]">M</kbd> para fazer comentários
        </p>
      </div>

      {/* Content */}
      <div className="divide-y divide-[var(--card-border)]">
        {activeTab === 'all' && allItems.map((item) =>
          item.type === 'comment'
            ? renderComment(item.data as Comment)
            : renderActivity(item.data as typeof activities[0])
        )}

        {activeTab === 'comments' && (
          <>
            {comments.length > 0 && (
              <div className="pb-3 pt-1">
                {/* Auto CTA: only when long thread and no summary yet */}
                {comments.length >= 5 && !aiSummary && !aiSummaryLoading && (
                  <button
                    type="button"
                    onClick={handleSummarizeThread}
                    className="mb-2 flex w-full items-center justify-between gap-3 rounded-lg border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 px-3.5 py-2.5 text-left transition hover:from-violet-500/15 hover:to-fuchsia-500/10"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-violet-300" />
                      <div>
                        <div className="text-[12.5px] font-semibold text-violet-200">Quer um resumo deste thread?</div>
                        <div className="text-[11px] text-secondary-muted">{comments.length} comentários — a IA pode resumir decisões e próximos passos</div>
                      </div>
                    </div>
                    <span className="rounded-md bg-violet-500/20 px-2 py-1 text-[11px] font-medium text-violet-200">Resumir</span>
                  </button>
                )}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleSummarizeThread}
                    disabled={aiSummaryLoading}
                    className="flex items-center gap-1.5 rounded-md border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-300 transition hover:bg-violet-500/15 hover:text-violet-200 disabled:opacity-50"
                  >
                    <Sparkles size={12} className={aiSummaryLoading ? 'animate-pulse' : ''} />
                    {aiSummaryLoading ? 'Resumindo...' : aiSummary ? 'Regerar resumo' : 'Resumir thread com IA'}
                  </button>
                  {aiSummary && (
                    <button
                      type="button"
                      onClick={() => setAiSummary(null)}
                      className="text-[11px] text-secondary-muted hover:text-primary"
                    >
                      Fechar resumo
                    </button>
                  )}
                </div>
                {aiSummaryError && (
                  <p className="mt-2 text-[12px] text-red-400">{aiSummaryError}</p>
                )}
                {aiSummaryLoading && !aiSummary && (
                  <div className="mt-2 rounded-lg border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 px-3.5 py-3 animate-pulse">
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-300">
                      <Sparkles size={11} />
                      Gerando resumo...
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-2 w-full rounded bg-violet-500/15" />
                      <div className="h-2 w-5/6 rounded bg-violet-500/15" />
                      <div className="h-2 w-3/4 rounded bg-violet-500/15" />
                    </div>
                  </div>
                )}
                {aiSummary && (
                  <div className="mt-2 rounded-lg border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 px-3.5 py-3">
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-300">
                      <Sparkles size={11} />
                      Resumo por IA
                    </div>
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-primary">{aiSummary}</p>
                  </div>
                )}
              </div>
            )}
            {comments.length > 0
              ? comments.map(renderComment)
              : <p className="py-6 text-center text-[13px] text-tertiary-muted">Nenhum comentário ainda.</p>}
          </>
        )}

        {activeTab === 'history' && (
          activities.filter((a) => a.field_name === 'status' || a.field_name === 'assignee').length > 0
            ? activities.filter((a) => a.field_name === 'status' || a.field_name === 'assignee').map(renderActivity)
            : <p className="py-6 text-center text-[13px] text-tertiary-muted">Nenhuma mudança registrada.</p>
        )}

        {activeTab === 'activity' && (
          activities.length > 0
            ? activities.map(renderActivity)
            : <p className="py-6 text-center text-[13px] text-tertiary-muted">Nenhuma atividade registrada.</p>
        )}

        {activeTab === 'time_status' && (
          Object.keys(statusTimes).length > 0 ? (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--card-border)]">
                  <th className="py-2 text-left font-medium text-secondary-muted">Status</th>
                  <th className="py-2 text-right font-medium text-secondary-muted">Tempo</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(statusTimes).map(([status, mins]) => (
                  <tr key={status} className="border-b border-[var(--card-border)]">
                    <td className="py-2 text-primary">{status}</td>
                    <td className="py-2 text-right font-medium text-secondary-muted">{formatMin(mins)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="py-6 text-center text-[13px] text-tertiary-muted">Nenhum dado de tempo.</p>
        )}
      </div>
    </div>
  );
}
