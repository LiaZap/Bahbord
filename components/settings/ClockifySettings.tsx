'use client';

import { useState, useEffect } from 'react';
import { Save, Trash2, RefreshCw, Check, AlertCircle, Link2 } from 'lucide-react';

interface ClockifyConfig {
  enabled: boolean;
  api_key: string | null;
  workspace_id: string | null;
  project_id: string | null;
}

export default function ClockifySettings() {
  const [config, setConfig] = useState<ClockifyConfig | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; total?: number; errors?: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const res = await fetch('/api/integrations/clockify');
      const data: ClockifyConfig = await res.json();
      setConfig(data);
      if (data.enabled) {
        setWorkspaceId(data.workspace_id || '');
        setProjectId(data.project_id || '');
        // Don't set apiKey — it's masked from the server
      }
    } catch (err) {
      console.error('Erro ao carregar config Clockify:', err);
    }
  }

  async function handleSave() {
    if (!apiKey || !workspaceId) {
      setError('API Key e Workspace ID são obrigatórios');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/integrations/clockify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          workspace_id: workspaceId,
          project_id: projectId || null,
        }),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        setApiKey('');
        await loadConfig();
      } else {
        const data = await res.json();
        setError(data.error || 'Erro ao salvar');
      }
    } catch (err) {
      console.error('Erro ao salvar config Clockify:', err);
      setError('Erro de conexão');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!confirm('Tem certeza que deseja remover a integração com o Clockify?')) return;

    setRemoving(true);
    setError(null);
    try {
      await fetch('/api/integrations/clockify', { method: 'DELETE' });
      setConfig({ enabled: false, api_key: null, workspace_id: null, project_id: null });
      setApiKey('');
      setWorkspaceId('');
      setProjectId('');
      setSyncResult(null);
    } catch (err) {
      console.error('Erro ao remover config Clockify:', err);
      setError('Erro ao remover integração');
    } finally {
      setRemoving(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const res = await fetch('/api/integrations/clockify/sync', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        setSyncResult(data);
      } else {
        setError(data.error || 'Erro na sincronização');
      }
    } catch (err) {
      console.error('Erro ao sincronizar:', err);
      setError('Erro de conexão durante sincronização');
    } finally {
      setSyncing(false);
    }
  }

  if (config === null) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white">Clockify</h2>

      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <div
          className={`h-2.5 w-2.5 rounded-full ${
            config.enabled ? 'bg-success' : 'bg-slate-500'
          }`}
        />
        <span className="text-sm text-slate-300">
          {config.enabled ? 'Conectado' : 'Desconectado'}
        </span>
        {config.enabled && config.api_key && (
          <span className="ml-2 rounded bg-surface px-2 py-0.5 font-mono text-xs text-slate-400">
            {config.api_key}
          </span>
        )}
      </div>

      {/* Config form */}
      <div className="rounded-lg border border-border/40 bg-surface2 p-5 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={config.enabled ? 'Digite nova chave para alterar' : 'Sua API Key do Clockify'}
            className="w-full rounded border border-border/40 bg-surface px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Encontre em Clockify &rarr; Profile Settings &rarr; API
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Workspace ID</label>
          <input
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            placeholder="ID do workspace no Clockify"
            className="w-full rounded border border-border/40 bg-surface px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Project ID (opcional)</label>
          <input
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="ID do projeto no Clockify"
            className="w-full rounded border border-border/40 bg-surface px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded bg-red-500/10 px-3 py-2 text-sm text-red-400">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>

          {config.enabled && (
            <button
              onClick={handleRemove}
              disabled={removing}
              className="flex items-center gap-1.5 rounded border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
            >
              <Trash2 size={14} />
              {removing ? 'Removendo...' : 'Remover'}
            </button>
          )}

          {saved && <span className="text-xs text-success">Salvo com sucesso!</span>}
        </div>
      </div>

      {/* Sync section */}
      {config.enabled && (
        <div className="rounded-lg border border-border/40 bg-surface2 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Sincronização</h3>
          <p className="text-xs text-slate-400">
            Envia registros de tempo do Bahjira para o Clockify que ainda não foram sincronizados.
          </p>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded bg-surface px-4 py-2 text-sm font-medium text-slate-200 border border-border/40 transition hover:bg-input/30 disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
          </button>

          {syncResult && (
            <div className="flex items-center gap-2 rounded bg-success/10 px-3 py-2 text-sm text-success">
              <Check size={14} />
              {syncResult.synced} de {syncResult.total ?? syncResult.synced} entradas sincronizadas
              {syncResult.errors && syncResult.errors.length > 0 && (
                <span className="ml-1 text-yellow-400">
                  ({syncResult.errors.length} erros)
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
