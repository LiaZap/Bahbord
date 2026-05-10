'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';

interface Client {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
}

export default function ClientsSettings() {
  const { confirm: doConfirm } = useConfirm();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');

  async function fetchClients() {
    try {
      const res = await fetch('/api/options?type=clients');
      if (res.ok) setClients(await res.json());
    } catch (err) { console.error('Erro ao carregar clientes:', err); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchClients(); }, []);

  async function handleUpdate(id: string, field: string, value: unknown) {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'clients', id, [field]: value }),
    });
    await fetchClients();
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'clients', name: newName.trim(), color: newColor, is_active: true }),
    });
    setNewName('');
    setAdding(false);
    await fetchClients();
  }

  async function handleDelete(id: string) {
    const ok = await doConfirm({ title: 'Remover cliente', message: 'Remover este cliente?', variant: 'danger' });
    if (!ok) return;
    const res = await fetch(`/api/settings?table=clients&id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      toast(err.error || 'Erro ao remover cliente', 'error');
      return;
    }
    await fetchClients();
  }

  if (loading) {
    return <div className="flex h-32 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Clientes</h2>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500"
        >
          <Plus size={14} />
          Novo cliente
        </button>
      </div>

      <div className="space-y-1">
        {clients.map((c) => (
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
            <button
              onClick={() => handleUpdate(c.id, 'is_active', !c.is_active)}
              className={cn(
                'rounded px-2 py-0.5 text-[10px] font-medium transition',
                c.is_active ? 'bg-success/20 text-success' : 'bg-slate-700 text-slate-500'
              )}
            >
              {c.is_active ? 'Ativo' : 'Inativo'}
            </button>
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
            placeholder="Nome do cliente"
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
