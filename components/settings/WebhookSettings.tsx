'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trash2, Plus, Send, Loader2 } from 'lucide-react';

interface WebhookSubscription {
  id: string;
  url: string;
  secret: string | null;
  events: string[];
  is_active: boolean;
  created_at: string;
}

const AVAILABLE_EVENTS = [
  { value: 'ticket.created', label: 'Ticket criado' },
  { value: 'ticket.updated', label: 'Ticket atualizado' },
  { value: 'ticket.status_changed', label: 'Status alterado' },
  { value: 'comment.created', label: 'Comentario criado' },
  { value: 'sprint.completed', label: 'Sprint concluida' },
];

export default function WebhookSettings() {
  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Form state
  const [formUrl, setFormUrl] = useState('');
  const [formSecret, setFormSecret] = useState('');
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchSubscriptions = useCallback(async () => {
    try {
      const res = await fetch('/api/webhook-subscriptions');
      const data = await res.json();
      if (Array.isArray(data)) setSubscriptions(data);
    } catch (err) {
      console.error('Erro ao carregar webhooks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const handleAdd = async () => {
    if (!formUrl.trim() || formEvents.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/webhook-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: formUrl.trim(),
          secret: formSecret.trim() || null,
          events: formEvents,
        }),
      });
      if (res.ok) {
        setFormUrl('');
        setFormSecret('');
        setFormEvents([]);
        setShowForm(false);
        fetchSubscriptions();
      }
    } catch (err) {
      console.error('Erro ao criar webhook:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (sub: WebhookSubscription) => {
    try {
      await fetch('/api/webhook-subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sub.id, is_active: !sub.is_active }),
      });
      fetchSubscriptions();
    } catch (err) {
      console.error('Erro ao atualizar webhook:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/webhook-subscriptions?id=${id}`, { method: 'DELETE' });
      fetchSubscriptions();
    } catch (err) {
      console.error('Erro ao remover webhook:', err);
    }
  };

  const handleTest = async (sub: WebhookSubscription) => {
    setTestingId(sub.id);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sub.secret) headers['X-Webhook-Secret'] = sub.secret;

      await fetch(sub.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          event: 'test',
          data: { message: 'Teste de webhook do BahBoard' },
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error('Teste de webhook falhou:', err);
    } finally {
      setTestingId(null);
    }
  };

  const toggleEvent = (event: string) => {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400">
        <Loader2 size={16} className="animate-spin" />
        Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Webhooks</h2>
          <p className="text-xs text-slate-400">
            Notifique sistemas externos (n8n, Zapier) quando eventos acontecem.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/80 transition"
        >
          <Plus size={14} />
          Adicionar
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">URL</label>
            <input
              type="url"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://n8n.example.com/webhook/..."
              className="w-full rounded-md border border-border bg-input px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Secret (opcional)</label>
            <input
              type="text"
              value={formSecret}
              onChange={(e) => setFormSecret(e.target.value)}
              placeholder="Chave secreta para validacao"
              className="w-full rounded-md border border-border bg-input px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Eventos</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {AVAILABLE_EVENTS.map((evt) => (
                <label
                  key={evt.value}
                  className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formEvents.includes(evt.value)}
                    onChange={() => toggleEvent(evt.value)}
                    className="rounded border-border accent-accent"
                  />
                  {evt.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAdd}
              disabled={saving || !formUrl.trim() || formEvents.length === 0}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/80 disabled:opacity-50 transition"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-slate-400 hover:text-white transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Subscription list */}
      {subscriptions.length === 0 && !showForm ? (
        <p className="text-sm text-slate-500">Nenhum webhook configurado.</p>
      ) : (
        <div className="space-y-2">
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              {/* Toggle */}
              <button
                onClick={() => handleToggle(sub)}
                className={`h-4 w-8 rounded-full transition ${
                  sub.is_active ? 'bg-accent' : 'bg-slate-600'
                } relative`}
              >
                <span
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                    sub.is_active ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm text-white">{sub.url}</p>
                <p className="text-[11px] text-slate-500">
                  {sub.events.join(', ')}
                </p>
              </div>

              {/* Actions */}
              <button
                onClick={() => handleTest(sub)}
                disabled={testingId === sub.id}
                className="rounded p-1.5 text-slate-400 hover:bg-input/50 hover:text-white transition"
                title="Testar webhook"
              >
                {testingId === sub.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
              </button>
              <button
                onClick={() => handleDelete(sub.id)}
                className="rounded p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition"
                title="Remover"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
