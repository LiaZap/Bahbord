'use client';

import { useState, useEffect, useCallback } from 'react';
import { SmilePlus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ReactionGroup {
  emoji: string;
  count: number;
  members: string[];
}

const commonEmojis = ['👍', '👎', '❤️', '🎉', '😄', '🤔', '👀', '🚀'];

interface CommentReactionsProps {
  commentId: string;
}

export default function CommentReactions({ commentId }: CommentReactionsProps) {
  const [reactions, setReactions] = useState<ReactionGroup[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const fetchReactions = useCallback(async () => {
    try {
      const res = await fetch(`/api/comment-reactions?comment_id=${commentId}`);
      if (res.ok) setReactions(await res.json());
    } catch (err) { console.error('Erro ao carregar reações:', err); }
  }, [commentId]);

  useEffect(() => { fetchReactions(); }, [fetchReactions]);

  async function toggleReaction(emoji: string) {
    await fetch('/api/comment-reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment_id: commentId, emoji }),
    });
    setShowPicker(false);
    await fetchReactions();
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => toggleReaction(r.emoji)}
          title={r.members.join(', ')}
          className="flex items-center gap-1 rounded-full border border-border/40 bg-surface px-1.5 py-0.5 text-[11px] transition hover:border-accent/40 hover:bg-surface2"
        >
          <span>{r.emoji}</span>
          <span className="text-slate-400">{r.count}</span>
        </button>
      ))}

      {/* Add reaction button */}
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="flex h-5 w-5 items-center justify-center rounded-full text-slate-600 transition hover:bg-surface2 hover:text-slate-300"
        >
          <SmilePlus size={12} />
        </button>

        {showPicker && (
          <div className="absolute bottom-full left-0 mb-1 flex gap-0.5 rounded-lg border border-border/40 bg-surface2 p-1.5 shadow-lg animate-scale-in z-10">
            {commonEmojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => toggleReaction(emoji)}
                className="rounded p-1 text-sm transition hover:bg-surface"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
