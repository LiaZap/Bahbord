'use client';

import { useState, useCallback, useEffect } from 'react';

interface Comment {
  id: string;
  body: string;
  created_at: string;
  author_name: string;
  author_email: string;
}

export function useComments(ticketId: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        await fetchComments();
      }
    } catch (err) { console.error('Erro ao enviar comentário:', err); }
    finally { setIsSubmitting(false); }
  }

  async function editComment(id: string, body: string) {
    try {
      const res = await fetch('/api/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, content: body }),
      });
      if (res.ok) {
        await fetchComments();
        return true;
      }
    } catch (err) { console.error('Erro ao editar comentário:', err); }
    return false;
  }

  async function deleteComment(id: string) {
    if (!confirm('Remover este comentário?')) return;
    try {
      const res = await fetch(`/api/comments?id=${id}`, { method: 'DELETE' });
      if (res.ok) await fetchComments();
    } catch (err) { console.error('Erro ao deletar comentário:', err); }
  }

  return {
    comments,
    isSubmitting,
    submitComment,
    editComment,
    deleteComment,
    refetch: fetchComments,
  };
}
