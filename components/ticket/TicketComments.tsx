'use client';

import { useState, useEffect } from 'react';
import { Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Comment {
  id: string;
  body: string;
  created_at: string;
  author_name: string;
  author_email: string;
}

interface TicketCommentsProps {
  ticketId: string;
}

export default function TicketComments({ ticketId }: TicketCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/comments?ticket_id=${ticketId}`)
      .then((r) => r.json())
      .then((data) => setComments(data))
      .catch((err) => console.error('Erro ao carregar comentários:', err));
  }, [ticketId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId, content: newComment.trim() })
      });

      if (res.ok) {
        setNewComment('');
        // Recarregar comentários
        const updated = await fetch(`/api/comments?ticket_id=${ticketId}`).then((r) => r.json());
        setComments(updated);
      }
    } catch (err) {
      console.error('Erro ao enviar comentário:', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  function getInitials(name: string) {
    return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
  }

  function timeAgo(dateStr: string) {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR });
    } catch {
      return dateStr;
    }
  }

  return (
    <section className="rounded-lg border border-border/40 bg-surface2 p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Comentários {comments.length > 0 && <span className="ml-1 text-slate-600">({comments.length})</span>}
      </h2>

      {/* Comment list */}
      {comments.length > 0 && (
        <div className="mb-4 space-y-3">
          {comments.map((c) => (
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
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New comment form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Escreva um comentário..."
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
    </section>
  );
}
