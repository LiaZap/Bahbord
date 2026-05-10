'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Copy, Check, Loader2, Lock, Eye, Calendar } from 'lucide-react';
import { useConfirm } from '@/components/ui/ConfirmModal';

interface Project {
  id: string;
  name: string;
  color: string;
}

interface Board {
  id: string;
  name: string;
  project_id: string;
}

interface ShareLink {
  id: string;
  slug: string;
  project_id: string | null;
  board_id: string | null;
  has_password: boolean;
  expires_at: string | null;
  views_count: number;
  created_at: string;
  project_name: string | null;
  project_color: string | null;
  board_name: string | null;
  created_by_name: string | null;
}

export default function ShareLinksSettings() {
  const { confirm: doConfirm } = useConfirm();
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Form state
  const [formProjectId, setFormProjectId] = useState('');
  const [formBoardId, setFormBoardId] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formExpiresAt, setFormExpiresAt] = useState('');

  const fetchLinks = useCallback(async () => {
    try {
      const res = await fetch('/api/share-links');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setLinks(data);
      }
    } catch (err) {
      console.error('Erro ao carregar share links:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProjectsAndBoards = useCallback(async () => {
    try {
      const [pRes, bRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/boards'),
      ]);
      if (pRes.ok) {
        const pData = await pRes.json();
        if (Array.isArray(pData)) setProjects(pData);
      }
      if (bRes.ok) {
        const bData = await bRes.json();
        if (Array.isArray(bData)) setBoards(bData);
      }
    } catch (err) {
      console.error('Erro ao carregar projetos/boards:', err);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
    fetchProjectsAndBoards();
  }, [fetchLinks, fetchProjectsAndBoards]);

  function resetForm() {
    setFormProjectId('');
    setFormBoardId('');
    setFormPassword('');
    setFormExpiresAt('');
    setError('');
  }

  async function handleCreate() {
    setError('');
    if (!formProjectId && !formBoardId) {
      setError('Selecione um projeto ou board.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/share-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: formProjectId || null,
          board_id: formBoardId || null,
          password: formPassword.trim() || null,
          expires_at: formExpiresAt || null,
        }),
      });
      if (res.ok) {
        resetForm();
        setShowForm(false);
        fetchLinks();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Erro ao criar link');
      }
    } catch (err) {
      console.error('Erro ao criar share link:', err);
      setError('Erro ao criar link');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await doConfirm({ title: 'Remover link', message: 'Remover este link? Clientes com o link perderão o acesso.', variant: 'danger' });
    if (!ok) return;
    try {
      const res = await fetch(`/api/share-links?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchLinks();
    } catch (err) {
      console.error('Erro ao remover share link:', err);
    }
  }

  function buildUrl(slug: string) {
    if (typeof window === 'undefined') return `/share/${slug}`;
    return `${window.location.origin}/share/${slug}`;
  }

  async function handleCopy(id: string, slug: string) {
    try {
      await navigator.clipboard.writeText(buildUrl(slug));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  }

  const filteredBoards = formProjectId
    ? boards.filter((b) => b.project_id === formProjectId)
    : boards;

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Links compartilháveis</h2>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Compartilhe um painel read-only com seus clientes. Suporte a senha e expiração.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm((v) => !v);
          }}
          className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500"
        >
          <Plus size={14} />
          Criar novo link
        </button>
      </div>

      {showForm && (
        <div className="card-premium space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Projeto
              </label>
              <select
                value={formProjectId}
                onChange={(e) => {
                  setFormProjectId(e.target.value);
                  setFormBoardId('');
                }}
                className="input-premium w-full"
              >
                <option value="">Selecionar projeto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Board (opcional)
              </label>
              <select
                value={formBoardId}
                onChange={(e) => setFormBoardId(e.target.value)}
                className="input-premium w-full"
                disabled={!formProjectId && boards.length === 0}
              >
                <option value="">Todos os boards do projeto</option>
                {filteredBoards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Senha (opcional)
              </label>
              <input
                type="text"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="Deixe em branco para link público"
                className="input-premium w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Expira em (opcional)
              </label>
              <input
                type="datetime-local"
                value={formExpiresAt}
                onChange={(e) => setFormExpiresAt(e.target.value)}
                className="input-premium w-full"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || (!formProjectId && !formBoardId)}
              className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Criar link
            </button>
          </div>
        </div>
      )}

      {links.length === 0 ? (
        <div className="card-premium flex h-32 items-center justify-center text-xs text-slate-500">
          Nenhum link criado ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link) => {
            const expired = link.expires_at && new Date(link.expires_at) < new Date();
            const url = buildUrl(link.slug);
            return (
              <div
                key={link.id}
                className="card-premium flex flex-wrap items-center gap-3 p-4"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold text-white"
                  style={{ backgroundColor: link.project_color || '#6366f1' }}
                >
                  {(link.project_name || link.board_name || 'B').charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13px] font-semibold text-white">
                      {link.project_name || 'Projeto removido'}
                    </p>
                    {link.board_name && (
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                        {link.board_name}
                      </span>
                    )}
                    {link.has_password && (
                      <span
                        title="Protegido por senha"
                        className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400"
                      >
                        <Lock size={10} />
                        Senha
                      </span>
                    )}
                    {expired && (
                      <span className="rounded bg-danger/15 px-1.5 py-0.5 text-[10px] font-medium text-danger">
                        Expirado
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">{url}</p>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <Eye size={10} />
                      {link.views_count} view{link.views_count === 1 ? '' : 's'}
                    </span>
                    {link.expires_at && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(link.expires_at).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    {link.created_by_name && (
                      <span className="truncate">por {link.created_by_name}</span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => handleCopy(link.id, link.slug)}
                    className="inline-flex items-center gap-1 rounded bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/[0.08]"
                  >
                    {copiedId === link.id ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        Copiar
                      </>
                    )}
                  </button>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/[0.08]"
                  >
                    Abrir
                  </a>
                  <button
                    onClick={() => handleDelete(link.id)}
                    className="rounded p-1 text-slate-600 transition hover:bg-danger/10 hover:text-danger"
                    title="Remover"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
