'use client';

import { useState, useEffect, useCallback } from 'react';
import { Key, Plus, Eye, EyeOff, Copy, Check, Pencil, Trash2, X, ExternalLink, Lock } from 'lucide-react';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { cn } from '@/lib/utils/cn';

interface Credential {
  id: string;
  page_id: string;
  label: string;
  username: string | null;
  url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by_name: string | null;
  updated_by_name: string | null;
}

interface CredentialsPanelProps {
  pageId: string;
}

interface FormState {
  label: string;
  username: string;
  url: string;
  notes: string;
  secret: string;
}

const EMPTY_FORM: FormState = { label: '', username: '', url: '', notes: '', secret: '' };

export default function CredentialsPanel({ pageId }: CredentialsPanelProps) {
  const { confirm: doConfirm } = useConfirm();
  const [items, setItems] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  // Revealed secrets are kept in-memory only — refresh = re-fetch + audit log
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealLoading, setRevealLoading] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/docs/credentials?page_id=${pageId}`);
      if (res.ok) {
        setItems(await res.json());
      }
    } catch (err) {
      console.error('Error loading credentials:', err);
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    setRevealed({});
    setEditingId(null);
    setCreating(false);
    setForm(EMPTY_FORM);
    load();
  }, [pageId, load]);

  async function save() {
    if (!form.label.trim()) return;
    if (!editingId && !form.secret) return; // novo precisa de secret
    setSaving(true);
    try {
      const isEdit = !!editingId;
      const url = '/api/docs/credentials';
      const method = isEdit ? 'PATCH' : 'POST';
      const body: Record<string, unknown> = {
        label: form.label.trim(),
        username: form.username || null,
        url: form.url || null,
        notes: form.notes || null,
      };
      if (isEdit) body.id = editingId;
      else body.page_id = pageId;
      if (form.secret) body.secret = form.secret;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setCreating(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
        await load();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Erro ao salvar');
      }
    } finally {
      setSaving(false);
    }
  }

  async function reveal(id: string, intent: 'view' | 'copy' = 'view') {
    setRevealLoading(id);
    try {
      const res = await fetch('/api/docs/credentials/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ id, intent }),
      });
      if (res.ok) {
        const data = await res.json();
        if (intent === 'copy') {
          try {
            await navigator.clipboard.writeText(data.secret);
            setCopiedId(id);
            setTimeout(() => setCopiedId(c => (c === id ? null : c)), 1500);
          } catch {
            // se clipboard falha, mostra o segredo pra usuário copiar manualmente
            setRevealed(r => ({ ...r, [id]: data.secret }));
          }
        } else {
          setRevealed(r => ({ ...r, [id]: data.secret }));
        }
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Falha ao revelar');
      }
    } catch (err) {
      console.error('reveal error:', err);
    } finally {
      setRevealLoading(null);
    }
  }

  function hide(id: string) {
    setRevealed(r => {
      const next = { ...r };
      delete next[id];
      return next;
    });
  }

  async function remove(id: string, label: string) {
    const ok = await doConfirm({
      title: 'Excluir credencial',
      message: `Excluir "${label}"? Esta ação não pode ser desfeita e fica registrada no audit log.`,
      variant: 'danger',
      confirmText: 'Excluir',
    });
    if (!ok) return;
    await fetch(`/api/docs/credentials?id=${id}`, { method: 'DELETE' });
    await load();
  }

  function startEdit(c: Credential) {
    setEditingId(c.id);
    setCreating(false);
    setForm({
      label: c.label,
      username: c.username || '',
      url: c.url || '',
      notes: c.notes || '',
      secret: '', // não pré-preenche — só atualiza se digitar
    });
  }

  function cancelForm() {
    setCreating(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  return (
    <div className="mt-8 border-t border-white/[0.06] pt-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <Lock size={14} className="text-amber-400/80" />
          Credenciais
          <span className="text-xs text-slate-600">({items.length})</span>
        </div>
        {!creating && !editingId && (
          <button
            onClick={() => { setCreating(true); setForm(EMPTY_FORM); }}
            className="flex items-center gap-1 rounded-md bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/[0.1]"
          >
            <Plus size={12} />
            Adicionar
          </button>
        )}
      </div>

      {(creating || editingId) && (
        <div className="mb-4 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">
              {editingId ? 'Editar credencial' : 'Nova credencial'}
            </span>
            <button onClick={cancelForm} className="text-slate-500 hover:text-slate-300">
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Rótulo *" value={form.label} onChange={v => setForm(f => ({ ...f, label: v }))} placeholder="Ex: Admin Somma" autoFocus />
            <Input label="Usuário / login" value={form.username} onChange={v => setForm(f => ({ ...f, username: v }))} placeholder="admin@cliente.com" />
            <Input label="URL (opcional)" value={form.url} onChange={v => setForm(f => ({ ...f, url: v }))} placeholder="https://painel.cliente.com" />
            <Input
              label={editingId ? 'Nova senha (deixe vazio pra manter)' : 'Senha *'}
              value={form.secret}
              onChange={v => setForm(f => ({ ...f, secret: v }))}
              placeholder={editingId ? '••••••••' : 'senha'}
              type="password"
            />
            <div className="col-span-2">
              <Input label="Notas (opcional)" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} placeholder="2FA app, observações..." />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={cancelForm}
              className="rounded-md px-3 py-1.5 text-xs text-slate-400 hover:bg-white/[0.06]"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving || !form.label.trim() || (!editingId && !form.secret)}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-600">Carregando...</div>
      ) : items.length === 0 && !creating ? (
        <div className="rounded-lg border border-dashed border-white/[0.06] py-6 text-center">
          <Key size={20} className="mx-auto mb-2 text-slate-700" />
          <p className="text-xs text-slate-600">Nenhuma credencial atrelada a esta página.</p>
          <p className="mt-0.5 text-[11px] text-slate-700">Cifrado AES-256-GCM. Cada visualização é registrada.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map(c => {
            const isOpen = !!revealed[c.id];
            return (
              <div
                key={c.id}
                className="group rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition hover:border-white/[0.1]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Key size={11} className="shrink-0 text-amber-400/70" />
                      <span className="text-xs font-medium text-slate-200 truncate">{c.label}</span>
                      {c.url && (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-slate-600 hover:text-slate-300"
                          title={c.url}
                        >
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      {c.username && (
                        <span className="flex items-center gap-1">
                          <span className="text-slate-700">login:</span>
                          <code className="rounded bg-white/[0.04] px-1 text-slate-400">{c.username}</code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(c.username || '');
                              setCopiedId(`u:${c.id}`);
                              setTimeout(() => setCopiedId(x => (x === `u:${c.id}` ? null : x)), 1200);
                            }}
                            className="text-slate-600 opacity-0 transition group-hover:opacity-100 hover:text-slate-300"
                            title="Copiar login"
                          >
                            {copiedId === `u:${c.id}` ? <Check size={10} /> : <Copy size={10} />}
                          </button>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <span className="text-slate-700">senha:</span>
                        <code className={cn(
                          'rounded bg-white/[0.04] px-1 font-mono',
                          isOpen ? 'text-amber-300' : 'text-slate-600'
                        )}>
                          {isOpen ? revealed[c.id] : '••••••••'}
                        </code>
                      </span>
                      {c.notes && (
                        <span className="text-slate-500 italic">{c.notes}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
                    {isOpen ? (
                      <button
                        onClick={() => hide(c.id)}
                        className="rounded p-1.5 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-300"
                        title="Ocultar"
                      >
                        <EyeOff size={13} />
                      </button>
                    ) : (
                      <button
                        onClick={() => reveal(c.id, 'view')}
                        disabled={revealLoading === c.id}
                        className="rounded p-1.5 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-300 disabled:opacity-50"
                        title="Revelar senha (auditado)"
                      >
                        <Eye size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => reveal(c.id, 'copy')}
                      disabled={revealLoading === c.id}
                      className="rounded p-1.5 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-300 disabled:opacity-50"
                      title="Copiar senha (auditado)"
                    >
                      {copiedId === c.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                    <button
                      onClick={() => startEdit(c)}
                      className="rounded p-1.5 text-slate-500 opacity-0 transition group-hover:opacity-100 hover:bg-white/[0.06] hover:text-slate-300"
                      title="Editar"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => remove(c.id, c.label)}
                      className="rounded p-1.5 text-red-400/60 opacity-0 transition group-hover:opacity-100 hover:bg-white/[0.06] hover:text-red-400"
                      title="Excluir"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Input({
  label, value, onChange, placeholder, type = 'text', autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <input
        type={type}
        autoFocus={autoFocus}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-xs text-slate-200 outline-none transition focus:border-accent/60 placeholder:text-slate-700"
      />
    </label>
  );
}
