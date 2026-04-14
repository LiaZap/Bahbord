'use client';

import { useState, useEffect } from 'react';
import { MessageCircle, Send, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface NotificationEvent {
  key: string;
  label: string;
  enabled: boolean;
}

const DEFAULT_EVENTS: NotificationEvent[] = [
  { key: 'ticket.assigned', label: 'Atribuido a um ticket', enabled: false },
  { key: 'ticket.mentioned', label: 'Mencionado em um comentario', enabled: false },
  { key: 'ticket.status_changed', label: 'Status do ticket alterado', enabled: false },
  { key: 'sprint.completed', label: 'Sprint concluida', enabled: false },
];

export default function WhatsAppSettings() {
  const [phone, setPhone] = useState('');
  const [originalPhone, setOriginalPhone] = useState('');
  const [events, setEvents] = useState<NotificationEvent[]>(DEFAULT_EVENTS);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/integrations/whatsapp').then((r) => r.json()),
      fetch('/api/options?type=members').then((r) => r.json()),
    ])
      .then(([whatsappStatus, members]) => {
        setConfigured(whatsappStatus.configured);

        // Use first member as current user (single-tenant)
        if (members.length > 0) {
          const member = members[0];
          setMemberId(member.id);
          setPhone(member.phone || '');
          setOriginalPhone(member.phone || '');
        }

        // Load notification preferences
        if (members.length > 0) {
          fetch(`/api/integrations/whatsapp/preferences?memberId=${members[0].id}`)
            .then((r) => r.json())
            .then((prefs: Array<{ event: string; is_enabled: boolean }>) => {
              if (Array.isArray(prefs) && prefs.length > 0) {
                setEvents((prev) =>
                  prev.map((ev) => {
                    const pref = prefs.find((p) => p.event === ev.key);
                    return pref ? { ...ev, enabled: pref.is_enabled } : ev;
                  })
                );
              }
            })
            .catch(() => {});
        }

        setLoading(false);
      })
      .catch((err) => {
        console.error('Erro ao carregar configuracoes WhatsApp:', err);
        setLoading(false);
      });
  }, []);

  async function handleSavePhone() {
    if (!memberId || phone === originalPhone) return;
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'members', id: memberId, phone }),
      });
      setOriginalPhone(phone);
    } catch (err) {
      console.error('Erro ao salvar telefone:', err);
    }
    setSaving(false);
  }

  async function handleToggleEvent(key: string, enabled: boolean) {
    if (!memberId) return;

    setEvents((prev) =>
      prev.map((ev) => (ev.key === key ? { ...ev, enabled } : ev))
    );

    try {
      await fetch('/api/integrations/whatsapp/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, event: key, channel: 'whatsapp', isEnabled: enabled }),
      });
    } catch (err) {
      console.error('Erro ao salvar preferencia:', err);
      // Revert on error
      setEvents((prev) =>
        prev.map((ev) => (ev.key === key ? { ...ev, enabled: !enabled } : ev))
      );
    }
  }

  async function handleTestMessage() {
    if (!phone) return;
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/integrations/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          message: 'Mensagem de teste do Bahjira! Se voce recebeu, a integracao esta funcionando.',
        }),
      });

      if (res.ok) {
        setTestResult('success');
      } else {
        setTestResult('error');
      }
    } catch {
      setTestResult('error');
    }

    setTesting(false);
    setTimeout(() => setTestResult(null), 5000);
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/15">
          <MessageCircle size={20} className="text-green-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">WhatsApp</h2>
          <p className="text-xs text-slate-400">Receba notificacoes via WhatsApp</p>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-surface2 px-4 py-3">
        {configured ? (
          <>
            <CheckCircle size={16} className="text-green-500" />
            <span className="text-sm text-green-400">API WhatsApp configurada</span>
          </>
        ) : (
          <>
            <XCircle size={16} className="text-amber-500" />
            <span className="text-sm text-amber-400">
              API WhatsApp nao configurada. Defina WHATSAPP_API_URL e WHATSAPP_API_TOKEN no .env
            </span>
          </>
        )}
      </div>

      {/* Phone number */}
      <div className="rounded-lg border border-border/40 bg-surface2 p-4 space-y-3">
        <label className="block text-sm font-medium text-slate-300">Numero do WhatsApp</label>
        <div className="flex gap-2">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={handleSavePhone}
            placeholder="5511999999999"
            className="flex-1 rounded border border-border/40 bg-surface px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent placeholder:text-slate-600"
          />
          <button
            onClick={handleSavePhone}
            disabled={saving || phone === originalPhone}
            className="rounded bg-accent px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
        <p className="text-xs text-slate-500">Formato: codigo do pais + DDD + numero (ex: 5511999999999)</p>
      </div>

      {/* Notification events */}
      <div className="rounded-lg border border-border/40 bg-surface2 p-4 space-y-3">
        <label className="block text-sm font-medium text-slate-300">Eventos de notificacao</label>
        <div className="space-y-2">
          {events.map((ev) => (
            <label
              key={ev.key}
              className="flex items-center justify-between rounded-md px-3 py-2 transition hover:bg-surface"
            >
              <span className="text-sm text-slate-300">{ev.label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={ev.enabled}
                onClick={() => handleToggleEvent(ev.key, !ev.enabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  ev.enabled ? 'bg-green-500' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${
                    ev.enabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </label>
          ))}
        </div>
      </div>

      {/* Test message */}
      <div className="rounded-lg border border-border/40 bg-surface2 p-4 space-y-3">
        <label className="block text-sm font-medium text-slate-300">Enviar mensagem de teste</label>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTestMessage}
            disabled={testing || !phone || !configured}
            className="flex items-center gap-1.5 rounded bg-green-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-green-500 disabled:opacity-50"
          >
            {testing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            Enviar teste
          </button>
          {testResult === 'success' && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle size={14} /> Enviado com sucesso
            </span>
          )}
          {testResult === 'error' && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <XCircle size={14} /> Falha ao enviar
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
