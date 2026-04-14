'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Status {
  id: string;
  name: string;
  color: string;
  position: number;
  wip_limit: number | null;
  is_done: boolean;
}

export default function StatusesSettings() {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6b7280');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchStatuses();
  }, []);

  async function fetchStatuses() {
    try {
      const res = await fetch('/api/options?type=statuses');
      if (res.ok) {
        const data = await res.json();
        setStatuses(data);
      }
    } catch (err) { console.error('Erro ao carregar statuses:', err); }
    finally { setLoading(false); }
  }

  async function handleUpdate(id: string, field: string, value: unknown) {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'statuses', id, [field]: value }),
    });
    await fetchStatuses();
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    const nextPos = statuses.length;
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'statuses', name: newName.trim(), color: newColor, position: nextPos, is_done: false }),
    });
    setNewName('');
    setNewColor('#6b7280');
    setAdding(false);
    await fetchStatuses();
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja remover este status?')) return;
    const res = await fetch(`/api/settings?table=statuses&id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      setMessage(err.error);
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    await fetchStatuses();
  }

  if (loading) {
    return <div className="flex h-32 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Colunas (Status)</h2>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500"
        >
          <Plus size={14} />
          Novo status
        </button>
      </div>

      {message && (
        <div className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{message}</div>
      )}

      {/* Mini kanban preview */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {statuses.map((s) => (
          <div key={s.id} className="flex min-w-[100px] flex-col items-center rounded-md bg-surface p-2">
            <div className="mb-1 h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-[10px] font-medium text-slate-400">{s.name}</span>
            {s.wip_limit && <span className="text-[9px] text-warning">MAX: {s.wip_limit}</span>}
          </div>
        ))}
      </div>

      {/* Status list */}
      <div className="space-y-1">
        {statuses.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-3 rounded-lg border border-border/40 bg-surface2 px-4 py-3"
          >
            <GripVertical size={14} className="cursor-grab text-slate-600" />

            {/* Color */}
            <input
              type="color"
              value={s.color}
              onChange={(e) => handleUpdate(s.id, 'color', e.target.value)}
              className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent"
            />

            {/* Name */}
            {editingId === s.id ? (
              <input
                autoFocus
                defaultValue={s.name}
                onBlur={(e) => { handleUpdate(s.id, 'name', e.target.value); setEditingId(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { handleUpdate(s.id, 'name', (e.target as HTMLInputElement).value); setEditingId(null); }}}
                className="flex-1 rounded border border-accent/40 bg-surface px-2 py-0.5 text-sm text-slate-200 outline-none"
              />
            ) : (
              <span
                onClick={() => setEditingId(s.id)}
                className="flex-1 cursor-pointer text-sm font-medium text-slate-200 hover:text-accent"
              >
                {s.name}
              </span>
            )}

            {/* WIP limit */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500">WIP:</span>
              <input
                type="number"
                value={s.wip_limit ?? ''}
                onChange={(e) => handleUpdate(s.id, 'wip_limit', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="-"
                className="w-12 rounded border border-border/40 bg-surface px-1.5 py-0.5 text-center text-xs text-slate-300 outline-none"
              />
            </div>

            {/* Is done toggle */}
            <button
              onClick={() => handleUpdate(s.id, 'is_done', !s.is_done)}
              className={cn(
                'rounded px-2 py-0.5 text-[10px] font-medium transition',
                s.is_done ? 'bg-success/20 text-success' : 'bg-slate-700 text-slate-500'
              )}
            >
              {s.is_done ? 'Concluído' : 'Normal'}
            </button>

            {/* Delete */}
            <button onClick={() => handleDelete(s.id)} className="text-slate-600 transition hover:text-danger">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Add new */}
      {adding && (
        <div className="flex items-center gap-3 rounded-lg border border-accent/30 bg-surface2 px-4 py-3">
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent"
          />
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="Nome do status"
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
