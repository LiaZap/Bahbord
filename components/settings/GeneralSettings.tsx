'use client';

import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  prefix: string;
  description: string | null;
}

export default function GeneralSettings() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data: Workspace) => {
        setWorkspace(data);
        setName(data.name);
        setPrefix(data.prefix);
        setDescription(data.description || '');
      })
      .catch((err) => console.error('Erro ao carregar settings:', err));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, prefix, description }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) { console.error('Erro ao salvar settings:', err); }
    finally { setSaving(false); }
  }

  if (!workspace) {
    return <div className="flex h-32 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white">Geral</h2>

      <div className="rounded-lg border border-border/40 bg-surface2 p-5 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Nome do workspace</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-border/40 bg-surface px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Prefixo dos tickets</label>
          <input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            maxLength={6}
            className="w-48 rounded border border-border/40 bg-surface px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Os tickets serão criados como <span className="font-mono text-slate-300">{prefix}-XXX</span>
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Descrição</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded border border-border/40 bg-surface px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          {saved && <span className="text-xs text-success">Salvo com sucesso!</span>}
        </div>
      </div>
    </div>
  );
}
