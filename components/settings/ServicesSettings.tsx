'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Service {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
}

export default function ServicesSettings() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [message, setMessage] = useState('');

  async function fetchServices() {
    try {
      const res = await fetch('/api/options?type=services');
      if (res.ok) setServices(await res.json());
    } catch (err) { console.error('Erro ao carregar serviços:', err); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchServices(); }, []);

  async function handleUpdate(id: string, field: string, value: unknown) {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'services', id, [field]: value }),
    });
    await fetchServices();
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'services', name: newName.trim(), color: newColor, is_active: true }),
    });
    setNewName('');
    setAdding(false);
    await fetchServices();
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este serviço?')) return;
    const res = await fetch(`/api/settings?table=services&id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      setMessage(err.error);
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    await fetchServices();
  }

  if (loading) {
    return <div className="flex h-32 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Serviços/Produtos</h2>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500"
        >
          <Plus size={14} />
          Novo serviço
        </button>
      </div>

      {message && (
        <div className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{message}</div>
      )}

      <div className="space-y-1">
        {services.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border/40 bg-surface2 px-4 py-3">
            <input
              type="color"
              value={s.color}
              onChange={(e) => handleUpdate(s.id, 'color', e.target.value)}
              className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent"
            />
            <span
              className="rounded px-2 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: s.color + '20', color: s.color }}
            >
              {s.name}
            </span>
            <span className="flex-1" />
            <button
              onClick={() => handleUpdate(s.id, 'is_active', !s.is_active)}
              className={cn(
                'rounded px-2 py-0.5 text-[10px] font-medium transition',
                s.is_active ? 'bg-success/20 text-success' : 'bg-slate-700 text-slate-500'
              )}
            >
              {s.is_active ? 'Ativo' : 'Inativo'}
            </button>
            <button onClick={() => handleDelete(s.id)} className="text-slate-600 transition hover:text-danger">
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
            placeholder="Nome do serviço"
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
