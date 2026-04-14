'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';

interface QuickReaction {
  id: string;
  emoji: string;
  label: string;
  position: number;
}

export default function QuickReactionsSettings() {
  const [reactions, setReactions] = useState<QuickReaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newEmoji, setNewEmoji] = useState('');
  const [newLabel, setNewLabel] = useState('');

  async function fetchReactions() {
    try {
      const res = await fetch('/api/quick-reactions');
      if (res.ok) setReactions(await res.json());
    } catch (err) { console.error('Erro ao carregar reações:', err); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchReactions(); }, []);

  async function handleUpdate(id: string, field: string, value: unknown) {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'quick_reactions', id, [field]: value }),
    });
    await fetchReactions();
  }

  async function handleAdd() {
    if (!newEmoji.trim() || !newLabel.trim()) return;
    const nextPos = reactions.length;
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'quick_reactions', emoji: newEmoji.trim(), label: newLabel.trim(), position: nextPos }),
    });
    setNewEmoji('');
    setNewLabel('');
    setAdding(false);
    await fetchReactions();
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta reação?')) return;
    await fetch(`/api/settings?table=quick_reactions&id=${id}`, { method: 'DELETE' });
    await fetchReactions();
  }

  if (loading) {
    return <div className="flex h-32 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Reações rápidas</h2>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500"
        >
          <Plus size={14} />
          Nova reação
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Reações rápidas aparecem abaixo do campo de comentários nos tickets para inserir respostas pré-definidas.
      </p>

      <div className="space-y-1">
        {reactions.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border/40 bg-surface2 px-4 py-3">
            <GripVertical size={14} className="cursor-grab text-slate-600" />
            <span className="text-lg">{r.emoji}</span>
            <span className="flex-1 text-sm text-slate-300">{r.label}</span>
            <button onClick={() => handleDelete(r.id)} className="text-slate-600 transition hover:text-danger">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {adding && (
        <div className="flex items-center gap-3 rounded-lg border border-accent/30 bg-surface2 px-4 py-3">
          <input
            value={newEmoji}
            onChange={(e) => setNewEmoji(e.target.value)}
            placeholder="Emoji"
            className="w-14 rounded border border-border/40 bg-surface px-2 py-1 text-center text-lg outline-none"
            maxLength={4}
          />
          <input
            autoFocus
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="Texto da reação"
            className="flex-1 rounded border border-border/40 bg-surface px-2 py-1 text-sm text-slate-200 outline-none focus:border-accent/60"
          />
          <button onClick={handleAdd} className="rounded bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-blue-500">
            Criar
          </button>
          <button onClick={() => setAdding(false)} className="text-xs text-slate-500 hover:text-slate-300">
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
