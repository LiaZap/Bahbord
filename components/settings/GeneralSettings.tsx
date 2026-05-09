'use client';

import { useState, useEffect } from 'react';
import { Save, Sun, Moon, Monitor, RefreshCw } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';

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
  const [syncing, setSyncing] = useState(false);
  const { theme, setTheme } = useTheme();

  async function handleSyncOrphans() {
    if (!confirm('Sincronizar tickets sem projeto? Os tickets serão atribuídos aos projetos baseado no acesso do relator/responsável.')) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/tickets/sync-project', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        alert(`${data.synced} ticket(s) sincronizado(s) com sucesso.`);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Erro ao sincronizar');
      }
    } finally {
      setSyncing(false);
    }
  }

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
      <h2 className="text-lg font-semibold text-primary">Geral</h2>

      <div className="rounded-lg border border-border/40 bg-surface2 p-5 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-secondary-muted">Nome do workspace</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-border/40 bg-surface px-3 py-2 text-sm text-primary outline-none focus:border-accent/60"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-secondary-muted">Prefixo dos tickets</label>
          <input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            maxLength={6}
            className="w-48 rounded border border-border/40 bg-surface px-3 py-2 text-sm text-primary outline-none focus:border-accent/60"
          />
          <p className="mt-1 text-[11px] text-secondary-muted">
            Os tickets serão criados como <span className="font-mono text-primary">{prefix}-XXX</span>
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-secondary-muted">Descrição</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded border border-border/40 bg-surface px-3 py-2 text-sm text-primary outline-none focus:border-accent/60"
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

      {/* Sync orphan tickets */}
      <div className="rounded-lg border border-border/40 bg-surface2 p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-primary mb-1">Sincronizar tickets</h3>
          <p className="text-xs text-secondary-muted">Atribui tickets sem projeto aos projetos corretos, baseado no acesso do relator/responsável.</p>
        </div>
        <button
          onClick={handleSyncOrphans}
          disabled={syncing}
          className="btn-premium btn-secondary"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Sincronizando...' : 'Sincronizar tickets órfãos'}
        </button>
      </div>

      {/* Theme */}
      <div className="rounded-lg border border-border/40 bg-surface2 p-5 space-y-3">
        <label className="block text-xs font-medium text-secondary-muted">Tema</label>
        <div className="flex gap-2">
          {([
            { key: 'light' as const, label: 'Claro', icon: Sun },
            { key: 'dark' as const, label: 'Escuro', icon: Moon },
            { key: 'system' as const, label: 'Sistema', icon: Monitor },
          ]).map((t) => {
            const Icon = t.icon;
            const active = theme === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTheme(t.key)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'bg-accent text-white'
                    : 'bg-surface text-secondary-muted hover:text-primary border border-border/40'
                }`}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
