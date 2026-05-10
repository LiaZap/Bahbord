'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit2, FileText, Loader2, X } from 'lucide-react';
import RichTextEditor from '@/components/editor/RichTextEditor';
import { useConfirm } from '@/components/ui/ConfirmModal';

interface TicketTemplate {
  id: string;
  workspace_id: string;
  name: string;
  ticket_type_id: string | null;
  ticket_type_name: string | null;
  title_template: string | null;
  description_html: string | null;
  priority: string | null;
  service_id: string | null;
  service_name: string | null;
  category_id: string | null;
  category_name: string | null;
  subtasks: string[];
  created_at: string;
}

interface SelectItem { id: string; name: string }

const PRIORITIES = [
  { value: '', label: '— sem padrão —' },
  { value: 'urgent', label: 'Urgente' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Média' },
  { value: 'low', label: 'Baixa' },
];

const emptyForm = {
  id: null as string | null,
  name: '',
  ticket_type_id: '',
  title_template: '',
  description_html: '',
  priority: '',
  service_id: '',
  category_id: '',
  subtasksRaw: '', // textarea — uma linha por subtask
};

export default function TicketTemplatesSettings() {
  const { confirm: doConfirm } = useConfirm();
  const [templates, setTemplates] = useState<TicketTemplate[]>([]);
  const [ticketTypes, setTicketTypes] = useState<SelectItem[]>([]);
  const [services, setServices] = useState<SelectItem[]>([]);
  const [categories, setCategories] = useState<SelectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/ticket-templates');
      const data = await res.json();
      if (Array.isArray(data)) setTemplates(data);
    } catch (err) {
      console.error('Erro ao carregar templates:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOptions = useCallback(async () => {
    try {
      const [tt, sv, cat] = await Promise.all([
        fetch('/api/options?type=ticket_types'),
        fetch('/api/options?type=services'),
        fetch('/api/options?type=categories'),
      ]);
      if (tt.ok) setTicketTypes(await tt.json());
      if (sv.ok) setServices(await sv.json());
      if (cat.ok) setCategories(await cat.json());
    } catch (err) {
      console.error('Erro ao carregar opções:', err);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchOptions();
  }, [fetchTemplates, fetchOptions]);

  function resetForm() {
    setForm(emptyForm);
    setFormError(null);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(t: TicketTemplate) {
    setForm({
      id: t.id,
      name: t.name,
      ticket_type_id: t.ticket_type_id || '',
      title_template: t.title_template || '',
      description_html: t.description_html || '',
      priority: t.priority || '',
      service_id: t.service_id || '',
      category_id: t.category_id || '',
      subtasksRaw: (t.subtasks || []).join('\n'),
    });
    setFormError(null);
    setShowForm(true);
  }

  async function handleSave() {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Nome é obrigatório');
      return;
    }

    const subtasks = form.subtasksRaw
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    setSaving(true);
    try {
      const payload = {
        id: form.id || undefined,
        name: form.name.trim(),
        ticket_type_id: form.ticket_type_id || null,
        title_template: form.title_template.trim() || null,
        description_html: form.description_html || null,
        priority: form.priority || null,
        service_id: form.service_id || null,
        category_id: form.category_id || null,
        subtasks,
      };
      const res = await fetch('/api/ticket-templates', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFormError(err.error || 'Erro ao salvar');
        return;
      }
      setShowForm(false);
      resetForm();
      fetchTemplates();
    } catch (err) {
      console.error('Erro ao salvar template:', err);
      setFormError('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await doConfirm({ title: 'Remover template', message: 'Remover este template?', variant: 'danger' });
    if (!ok) return;
    try {
      await fetch(`/api/ticket-templates?id=${id}`, { method: 'DELETE' });
      fetchTemplates();
    } catch (err) {
      console.error('Erro ao remover template:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-secondary">
        <Loader2 size={16} className="animate-spin" />
        Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-primary">Templates de ticket</h2>
          <p className="text-xs text-secondary">
            Modelos reutilizáveis pra criar tickets com campos pré-preenchidos (Bug, Feature, etc.).
          </p>
        </div>
        <button
          onClick={openCreate}
          className="btn-premium btn-primary flex items-center gap-1.5 text-xs"
        >
          <Plus size={14} />
          Novo template
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card-premium space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary">
              {form.id ? 'Editar template' : 'Novo template'}
            </h3>
            <button
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="rounded p-1 text-secondary hover:text-primary"
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-secondary">Nome do template</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Bug Template"
                className="input-premium w-full text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-secondary">Tipo de ticket</label>
              <select
                value={form.ticket_type_id}
                onChange={(e) => setForm({ ...form, ticket_type_id: e.target.value })}
                className="input-premium w-full text-sm"
              >
                <option value="">— sem tipo padrão —</option>
                {ticketTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-secondary">Título base (opcional)</label>
            <input
              type="text"
              value={form.title_template}
              onChange={(e) => setForm({ ...form, title_template: e.target.value })}
              placeholder="Ex.: [Bug] "
              className="input-premium w-full text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-secondary">Descrição (HTML)</label>
            <RichTextEditor
              content={form.description_html}
              onChange={(v) => setForm({ ...form, description_html: v })}
              placeholder="Conteúdo do template..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-secondary">Prioridade</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="input-premium w-full text-sm"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-secondary">Serviço/Produto</label>
              <select
                value={form.service_id}
                onChange={(e) => setForm({ ...form, service_id: e.target.value })}
                className="input-premium w-full text-sm"
              >
                <option value="">—</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-secondary">Categoria</label>
              <select
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="input-premium w-full text-sm"
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-secondary">
              Checklist de subtasks (uma por linha)
            </label>
            <textarea
              value={form.subtasksRaw}
              onChange={(e) => setForm({ ...form, subtasksRaw: e.target.value })}
              rows={4}
              placeholder={'Reproduzir o bug\nDocumentar steps\nFix + teste'}
              className="input-premium w-full text-sm font-mono"
            />
          </div>

          {formError && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {formError}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-premium btn-primary text-xs disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="btn-premium btn-ghost text-xs"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {templates.length === 0 && !showForm ? (
        <p className="text-sm text-secondary">Nenhum template cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="card-premium flex items-start gap-3 px-4 py-3"
            >
              <FileText size={14} className="mt-1 shrink-0 text-accent" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="truncate text-sm font-medium text-primary">{t.name}</p>
                  {t.ticket_type_name && (
                    <span className="rounded-full bg-input/50 px-2 py-0.5 text-[10px] text-secondary">
                      {t.ticket_type_name}
                    </span>
                  )}
                  {t.priority && (
                    <span className="rounded-full bg-input/50 px-2 py-0.5 text-[10px] uppercase text-secondary">
                      {t.priority}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-secondary">
                  {t.service_name && <span>Serviço: <span className="text-primary">{t.service_name}</span></span>}
                  {t.category_name && <span>Categoria: <span className="text-primary">{t.category_name}</span></span>}
                  {t.subtasks && t.subtasks.length > 0 && (
                    <span>
                      Subtasks: <span className="text-primary">{t.subtasks.length}</span>
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => openEdit(t)}
                className="rounded p-1.5 text-secondary transition hover:bg-input/50 hover:text-primary"
                title="Editar"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => handleDelete(t.id)}
                className="rounded p-1.5 text-secondary transition hover:bg-red-500/20 hover:text-red-400"
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
