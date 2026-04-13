'use client';

import { useState, useEffect } from 'react';

interface QuickReaction {
  id: string;
  emoji: string;
  label: string;
}

interface QuickReactionsProps {
  onReact: (text: string) => void;
}

export default function QuickReactions({ onReact }: QuickReactionsProps) {
  const [reactions, setReactions] = useState<QuickReaction[]>([]);

  useEffect(() => {
    fetch('/api/quick-reactions')
      .then((r) => r.json())
      .then(setReactions)
      .catch(() => {});
  }, []);

  if (reactions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {reactions.map((r) => (
        <button
          key={r.id}
          onClick={() => onReact(`${r.emoji} ${r.label}`)}
          className="rounded-full border border-border/40 bg-surface px-2.5 py-1 text-[11px] text-slate-400 transition hover:border-accent/40 hover:bg-surface2 hover:text-slate-200"
          title={r.label}
        >
          {r.emoji} {r.label}
        </button>
      ))}
    </div>
  );
}
