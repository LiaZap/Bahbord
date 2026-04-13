'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';

interface TicketType {
  id: string;
  name: string;
  icon: string;
  color: string;
  description_template: string | null;
  position: number;
}

export default function TicketTypesSettings() {
  const [types, setTypes] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [templateValue, setTemplateValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');

  async function fetchTypes() {
    try {
      const res = await fetch('/api/options?type=ticket_types');
      if (res.ok) setTypes(await res.json());
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchTypes(); }, []);

  async function handleUpdate(id: string, field: string, value: unknown) {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'ticket_types', id, [field]: value }),
    });
    await fetchTypes();
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    const nextPos = types.length;
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'ticket_types', name: newName.trim(), icon: newIcon || null, color: newColor, position: nextPos }),
    });
    setNewName('');
    setNewIcon('');
    setAdding(false);
    await fetchTypes();
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este tipo de ticket?')) return;
    await fetch(`/api/settings?table=ticket_types&id=${id}`, { method: 'DELETE' });
    await fetchTypes();
  }

  async function saveTemplate(id: string) {
    await handleUpdate(id, 'description_template', templateValue || null);
    setEditingTemplate(null);
  }

  if (loading) {
    return <div className="flex h-32 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Tipos de ticket</h2>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500"
        >
          <Plus size={14} />
          Novo tipo
        </button>
      </div>

      <div className="space-y-1">
        {types.map((t) => (
          <div key={t.id} className="rounded-lg border border-border/40 bg-surface2">
            <div className="flex items-center gap-3 px-4 py-3">
              <GripVertical size={14} className="cursor-grab text-slate-600" />

              {/* Icon */}
              {editingId === t.id + '-icon' ? (
                <input
                  autoFocus
                  defaultValue={t.icon}
                  onBlur={(e) => { handleUpdate(t.id, 'icon', e.target.value); setEditingId(null); }}
                  className="w-10 rounded border border-accent/40 bg-surface px-1 py-0.5 text-center text-sm outline-none"
                  maxLength={4}
                />
              ) : (
                <span
                  onClick={() => setEditingId(t.id + '-icon')}
                  className="cursor-pointer text-lg"
                  title="Editar ícone"
                >
                  {t.icon || '?'}
                </span>
              )}

              {/* Color */}
              <input
                type="color"
                value={t.color}
                onChange={(e) => handleUpdate(t.id, 'color', e.target.value)}
                className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent"
              />

              {/* Name */}
              {editingId === t.id ? (
                <input
                  autoFocus
                  defaultValue={t.name}
                  onBlur={(e) => { handleUpdate(t.id, 'name', e.target.value); setEditingId(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { handleUpdate(t.id, 'name', (e.target as HTMLInputElement).value); setEditingId(null); }}}
                  className="flex-1 rounded border border-accent/40 bg-surface px-2 py-0.5 text-sm text-slate-200 outline-none"
                />
              ) : (
                <span
                  onClick={() => setEditingId(t.id)}
                  className="flex-1 cursor-pointer text-sm font-medium text-slate-200 hover:text-accent"
                >
                  {t.name}
                </span>
              )}

              {/* Template button */}
              <button
                onClick={() => {
                  if (editingTemplate === t.id) { setEditingTemplate(null); }
                  else { setEditingTemplate(t.id); setTemplateValue(t.description_template || ''); }
                }}
                className="rounded px-2 py-0.5 text-[10px] text-slate-500 transition hover:bg-surface hover:text-slate-300"
              >
                Template
              </button>

              <button onClick={() => handleDelete(t.id)} className="text-slate-600 transition hover:text-danger">
                <Trash2 size={14} />
              </button>
            </div>

            {/* Template editor */}
            {editingTemplate === t.id && (
              <div className="border-t border-border/30 px-4 py-3">
                <label className="mb-1 block text-[10px] font-medium text-slate-500">Template da descrição</label>
                <textarea
                  value={templateValue}
                  onChange={(e) => setTemplateValue(e.target.value)}
                  rows={4}
                  className="w-full rounded border border-border/40 bg-surface px-3 py-2 text-xs text-slate-300 outline-none focus:border-accent/60"
                  placeholder="**Campo:**&#10;&#10;**Outro campo:**"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => saveTemplate(t.id)}
                    className="rounded bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-blue-500"
                  >
                    Salvar
                  </button>
                  <button onClick={() => setEditingTemplate(null)} className="text-xs text-slate-500 hover:text-slate-300">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding && (
        <div className="flex items-center gap-3 rounded-lg border border-accent/30 bg-surface2 px-4 py-3">
          <input
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
            placeholder="Emoji"
            className="w-12 rounded border border-border/40 bg-surface px-1 py-1 text-center text-sm text-slate-200 outline-none"
            maxLength={4}
          />
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
            placeholder="Nome do tipo"
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
