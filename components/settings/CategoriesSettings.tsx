'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  color: string;
}

export default function CategoriesSettings() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#f59e0b');

  async function fetchCategories() {
    try {
      const res = await fetch('/api/options?type=categories');
      if (res.ok) setCategories(await res.json());
    } catch (err) { console.error('Erro ao carregar categorias:', err); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchCategories(); }, []);

  async function handleUpdate(id: string, field: string, value: unknown) {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'categories', id, [field]: value }),
    });
    await fetchCategories();
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'categories', name: newName.trim(), color: newColor }),
    });
    setNewName('');
    setAdding(false);
    await fetchCategories();
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta categoria?')) return;
    await fetch(`/api/settings?table=categories&id=${id}`, { method: 'DELETE' });
    await fetchCategories();
  }

  if (loading) {
    return <div className="flex h-32 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Categorias</h2>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500"
        >
          <Plus size={14} />
          Nova categoria
        </button>
      </div>

      <div className="space-y-1">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border/40 bg-surface2 px-4 py-3">
            <input
              type="color"
              value={c.color}
              onChange={(e) => handleUpdate(c.id, 'color', e.target.value)}
              className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent"
            />
            <span
              className="rounded px-2 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: c.color + '20', color: c.color }}
            >
              {c.name}
            </span>
            <span className="flex-1" />
            <button onClick={() => handleDelete(c.id)} className="text-slate-600 transition hover:text-danger">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

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
            placeholder="Nome da categoria"
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
