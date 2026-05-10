'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Zap, Filter, Wrench } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

// ───────── Tipos públicos ─────────

export interface Automation {
  id: string;
  workspace_id: string;
  project_id: string | null;
  project_name?: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_event: string;
  trigger_conditions: Record<string, unknown> | null;
  action_type: string;
  action_params: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SelectItem {
  id: string;
  name: string;
}

// ───────── Catálogos ─────────

export type TriggerEvent =
  | 'ticket.created'
  | 'ticket.status_changed'
  | 'ticket.assigned';

export type ActionType =
  | 'assign_to'
  | 'add_comment'
  | 'set_priority'
  | 'notify_member';

export const TRIGGER_EVENTS: { value: TriggerEvent; label: string }[] = [
  { value: 'ticket.created', label: 'Quando um ticket é criado' },
  { value: 'ticket.status_changed', label: 'Quando o status do ticket muda' },
  { value: 'ticket.assigned', label: 'Quando o responsável muda' },
];

export const ACTION_TYPES: { value: ActionType; label: string }[] = [
  { value: 'assign_to', label: 'Atribuir para um membro' },
  { value: 'add_comment', label: 'Adicionar comentário' },
  { value: 'set_priority', label: 'Definir prioridade' },
  { value: 'notify_member', label: 'Notificar membro' },
];

// Campos disponíveis em condições. Mantemos paridade com o ticket real
// (lib/automations.ts faz comparação direta de igualdade contra ctx.ticket[key]).
type ConditionField =
  | 'priority'
  | 'service_id'
  | 'category_id'
  | 'ticket_type_id'
  | 'status_id'
  | 'client_id'
  | 'assignee_id';

interface ConditionFieldDef {
  value: ConditionField;
  label: string;
  /** Tipo de UI que renderizamos para escolher o valor. */
  kind: 'priority' | 'option';
  /** Quando kind === 'option', qual recurso buscar via /api/options. */
  optionType?: 'services' | 'categories' | 'ticket_types' | 'statuses' | 'clients' | 'members';
}

const CONDITION_FIELDS: ConditionFieldDef[] = [
  { value: 'priority', label: 'Prioridade', kind: 'priority' },
  { value: 'service_id', label: 'Serviço/Produto', kind: 'option', optionType: 'services' },
  { value: 'category_id', label: 'Categoria', kind: 'option', optionType: 'categories' },
  { value: 'ticket_type_id', label: 'Tipo de ticket', kind: 'option', optionType: 'ticket_types' },
  { value: 'status_id', label: 'Status', kind: 'option', optionType: 'statuses' },
  { value: 'client_id', label: 'Cliente', kind: 'option', optionType: 'clients' },
  { value: 'assignee_id', label: 'Responsável', kind: 'option', optionType: 'members' },
];

const PRIORITIES: { value: string; label: string }[] = [
  { value: 'urgent', label: 'Urgente' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Média' },
  { value: 'low', label: 'Baixa' },
];

// ───────── Estado interno do form ─────────

interface ConditionRow {
  /** key estável para React (não vai pro payload) */
  uid: string;
  field: ConditionField | '';
  value: string;
}

interface FormState {
  name: string;
  description: string;
  project_id: string;
  is_active: boolean;
  trigger_event: TriggerEvent;
  conditions: ConditionRow[];
  action_type: ActionType;
  action_member_id: string;
  action_priority: string;
  action_text: string;
  action_message: string;
}

function makeUid(): string {
  return `c_${Math.random().toString(36).slice(2, 10)}`;
}

function emptyForm(): FormState {
  return {
    name: '',
    description: '',
    project_id: '',
    is_active: true,
    trigger_event: 'ticket.created',
    conditions: [],
    action_type: 'assign_to',
    action_member_id: '',
    action_priority: 'medium',
    action_text: '',
    action_message: '',
  };
}

function fromAutomation(a: Automation): FormState {
  const cond = a.trigger_conditions || {};
  const rows: ConditionRow[] = Object.entries(cond)
    .filter(([k]) => CONDITION_FIELDS.some((f) => f.value === k))
    .map(([k, v]) => ({
      uid: makeUid(),
      field: k as ConditionField,
      value: typeof v === 'string' ? v : v == null ? '' : String(v),
    }));

  const params = a.action_params || {};
  const memberId = typeof params.member_id === 'string' ? params.member_id : '';
  const priority =
    typeof params.priority === 'string' && PRIORITIES.some((p) => p.value === params.priority)
      ? (params.priority as string)
      : 'medium';
  const text = typeof params.text === 'string' ? params.text : '';
  const message = typeof params.message === 'string' ? params.message : '';

  const trigger: TriggerEvent = TRIGGER_EVENTS.some((e) => e.value === a.trigger_event)
    ? (a.trigger_event as TriggerEvent)
    : 'ticket.created';
  const action: ActionType = ACTION_TYPES.some((x) => x.value === a.action_type)
    ? (a.action_type as ActionType)
    : 'assign_to';

  return {
    name: a.name,
    description: a.description || '',
    project_id: a.project_id || '',
    is_active: a.is_active,
    trigger_event: trigger,
    conditions: rows,
    action_type: action,
    action_member_id: memberId,
    action_priority: priority,
    action_text: text,
    action_message: message,
  };
}

// ───────── Component ─────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: Automation | null;
  projects: SelectItem[];
}

interface OptionsBundle {
  services: SelectItem[];
  categories: SelectItem[];
  ticket_types: SelectItem[];
  statuses: SelectItem[];
  clients: SelectItem[];
  members: SelectItem[];
}

const EMPTY_OPTIONS: OptionsBundle = {
  services: [],
  categories: [],
  ticket_types: [],
  statuses: [],
  clients: [],
  members: [],
};

interface OptionRow {
  id: string;
  name?: string;
  display_name?: string;
}

export default function AutomationFormModal({
  isOpen,
  onClose,
  onSaved,
  editing,
  projects,
}: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<OptionsBundle>(EMPTY_OPTIONS);

  // Carrega listas auxiliares uma vez por abertura.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function load() {
      try {
        const types: (keyof OptionsBundle)[] = [
          'services',
          'categories',
          'ticket_types',
          'statuses',
          'clients',
          'members',
        ];
        const results = await Promise.all(
          types.map((t) => fetch(`/api/options?type=${t}`).then((r) => (r.ok ? r.json() : [])))
        );
        if (cancelled) return;

        const next: OptionsBundle = { ...EMPTY_OPTIONS };
        types.forEach((t, i) => {
          const rows: OptionRow[] = Array.isArray(results[i]) ? results[i] : [];
          next[t] = rows.map((row) => ({
            id: row.id,
            name: row.name || row.display_name || row.id,
          }));
        });
        setOptions(next);
      } catch {
        // mantém EMPTY_OPTIONS — o usuário ainda consegue salvar em modo "simples"
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Reset ao abrir.
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setForm(editing ? fromAutomation(editing) : emptyForm());
  }, [isOpen, editing]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addCondition() {
    setForm((prev) => ({
      ...prev,
      conditions: [...prev.conditions, { uid: makeUid(), field: '', value: '' }],
    }));
  }

  function updateCondition(uid: string, patch: Partial<ConditionRow>) {
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.map((c) => (c.uid === uid ? { ...c, ...patch } : c)),
    }));
  }

  function removeCondition(uid: string) {
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((c) => c.uid !== uid),
    }));
  }

  // Resumo narrativo do que foi montado (visível enquanto edita).
  const narrative = useMemo(() => buildNarrative(form, projects, options), [form, projects, options]);

  async function handleSave() {
    setError(null);

    const name = form.name.trim();
    if (!name) {
      setError('Informe um nome para a automação.');
      return;
    }

    // Conditions → JSONB (somente linhas válidas).
    const conditionsObj: Record<string, string> = {};
    for (const row of form.conditions) {
      if (!row.field) continue;
      if (!row.value) {
        setError('Preencha o valor de todas as condições ou remova-as.');
        return;
      }
      conditionsObj[row.field] = row.value;
    }

    // Action params → valida campos obrigatórios.
    const action_params: Record<string, string> = {};
    switch (form.action_type) {
      case 'assign_to':
        if (!form.action_member_id) {
          setError('Selecione o membro para atribuir o ticket.');
          return;
        }
        action_params.member_id = form.action_member_id;
        break;
      case 'set_priority':
        if (!form.action_priority) {
          setError('Selecione a prioridade.');
          return;
        }
        action_params.priority = form.action_priority;
        break;
      case 'add_comment':
        if (!form.action_text.trim()) {
          setError('Escreva o texto do comentário.');
          return;
        }
        action_params.text = form.action_text.trim();
        break;
      case 'notify_member':
        if (!form.action_member_id) {
          setError('Selecione o membro a notificar.');
          return;
        }
        action_params.member_id = form.action_member_id;
        if (form.action_message.trim()) {
          action_params.message = form.action_message.trim();
        }
        break;
    }

    const payload = {
      id: editing?.id,
      name,
      description: form.description.trim() || null,
      project_id: form.project_id || null,
      is_active: form.is_active,
      trigger_event: form.trigger_event,
      trigger_conditions: conditionsObj,
      action_type: form.action_type,
      action_params,
    };

    setSaving(true);
    try {
      const res = await fetch('/api/automations', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Erro ao salvar a automação.');
        return;
      }
      toast(editing ? 'Automação atualizada' : 'Automação criada', 'success');
      onSaved();
      onClose();
    } catch {
      setError('Erro de rede ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Editar automação' : 'Nova automação'}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5 px-5 py-5">
        {/* Resumo narrativo */}
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-4 py-3 text-[13px] leading-relaxed text-secondary-muted">
          {narrative}
        </div>

        {/* Passo 1 — Quando */}
        <Step
          number={1}
          icon={<Zap size={14} />}
          title="Quando"
          subtitle="Escolha o evento que dispara a automação."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-tertiary-muted">Evento</label>
              <select
                value={form.trigger_event}
                onChange={(e) => setField('trigger_event', e.target.value as TriggerEvent)}
                className="input-premium w-full text-sm"
              >
                {TRIGGER_EVENTS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-tertiary-muted">Escopo</label>
              <select
                value={form.project_id}
                onChange={(e) => setField('project_id', e.target.value)}
                className="input-premium w-full text-sm"
              >
                <option value="">Em qualquer projeto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    Apenas no projeto: {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Step>

        {/* Passo 2 — Se */}
        <Step
          number={2}
          icon={<Filter size={14} />}
          title="Se (condições)"
          subtitle="Opcional. Combinadas com E lógico — todas precisam ser verdadeiras."
        >
          {form.conditions.length === 0 ? (
            <p className="text-[12px] text-tertiary-muted">
              Sem condições. A regra dispara em todos os eventos.
            </p>
          ) : (
            <div className="space-y-2">
              {form.conditions.map((row) => {
                const def = CONDITION_FIELDS.find((f) => f.value === row.field);
                return (
                  <div
                    key={row.uid}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-2 py-2"
                  >
                    <select
                      value={row.field}
                      onChange={(e) =>
                        updateCondition(row.uid, {
                          field: e.target.value as ConditionField,
                          value: '',
                        })
                      }
                      className="input-premium min-w-[140px] flex-1 text-xs"
                    >
                      <option value="">— escolha o campo —</option>
                      {CONDITION_FIELDS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <span className="text-[11px] text-tertiary-muted">é</span>
                    <ConditionValueInput
                      def={def}
                      value={row.value}
                      onChange={(v) => updateCondition(row.uid, { value: v })}
                      options={options}
                    />
                    <button
                      type="button"
                      onClick={() => removeCondition(row.uid)}
                      className="rounded p-1 text-secondary-muted hover:bg-[var(--overlay-hover)] hover:text-red-400"
                      aria-label="Remover condição"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={addCondition}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-dashed border-[var(--card-border)] px-2.5 py-1.5 text-[12px] text-secondary-muted transition hover:border-solid hover:bg-[var(--overlay-subtle)] hover:text-primary"
          >
            <Plus size={12} />
            Adicionar condição
          </button>
        </Step>

        {/* Passo 3 — Faça */}
        <Step
          number={3}
          icon={<Wrench size={14} />}
          title="Faça"
          subtitle="A ação executada quando o gatilho dispara e as condições batem."
        >
          <div>
            <label className="mb-1 block text-[11px] font-medium text-tertiary-muted">Ação</label>
            <select
              value={form.action_type}
              onChange={(e) => setField('action_type', e.target.value as ActionType)}
              className="input-premium w-full text-sm"
            >
              {ACTION_TYPES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3">
            <ActionParamsInput
              type={form.action_type}
              form={form}
              setField={setField}
              members={options.members}
            />
          </div>
        </Step>

        {/* Footer — meta */}
        <div className="space-y-3 border-t border-[var(--card-border)] pt-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-tertiary-muted">
                Nome <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="Ex.: Urgente → líder"
                className="input-premium w-full text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-tertiary-muted">
                Descrição (opcional)
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                className="input-premium w-full text-sm"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-[12px] text-secondary-muted">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setField('is_active', e.target.checked)}
              className="rounded border-[var(--card-border)] accent-accent"
            />
            Ativar imediatamente
          </label>

          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-premium btn-ghost text-xs">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-premium btn-primary text-xs disabled:opacity-50"
            >
              {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar automação'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ───────── Sub-components ─────────

function Step({
  number,
  icon,
  title,
  subtitle,
  children,
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
      <header className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent">
          {number}
        </span>
        <span className="text-accent">{icon}</span>
        <h4 className="text-sm font-semibold text-primary">{title}</h4>
      </header>
      <p className="mb-3 text-[12px] text-tertiary-muted">{subtitle}</p>
      {children}
    </section>
  );
}

function ConditionValueInput({
  def,
  value,
  onChange,
  options,
}: {
  def: ConditionFieldDef | undefined;
  value: string;
  onChange: (v: string) => void;
  options: OptionsBundle;
}) {
  if (!def) {
    return (
      <select disabled className="input-premium min-w-[160px] flex-1 text-xs opacity-60">
        <option>— escolha o campo primeiro —</option>
      </select>
    );
  }

  if (def.kind === 'priority') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-premium min-w-[160px] flex-1 text-xs"
      >
        <option value="">— escolha —</option>
        {PRIORITIES.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    );
  }

  const list = def.optionType ? options[def.optionType] : [];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input-premium min-w-[160px] flex-1 text-xs"
    >
      <option value="">— escolha —</option>
      {list.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}

function ActionParamsInput({
  type,
  form,
  setField,
  members,
}: {
  type: ActionType;
  form: FormState;
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  members: SelectItem[];
}) {
  switch (type) {
    case 'assign_to':
      return (
        <div>
          <label className="mb-1 block text-[11px] font-medium text-tertiary-muted">Membro</label>
          <select
            value={form.action_member_id}
            onChange={(e) => setField('action_member_id', e.target.value)}
            className="input-premium w-full text-sm"
          >
            <option value="">— escolha o responsável —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      );
    case 'set_priority':
      return (
        <div>
          <label className="mb-1 block text-[11px] font-medium text-tertiary-muted">Prioridade</label>
          <div className="flex flex-wrap gap-2">
            {PRIORITIES.map((p) => {
              const active = form.action_priority === p.value;
              return (
                <button
                  type="button"
                  key={p.value}
                  onClick={() => setField('action_priority', p.value)}
                  className={
                    active
                      ? 'rounded-md border border-accent bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent'
                      : 'rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-3 py-1.5 text-xs text-secondary-muted transition hover:bg-[var(--overlay-hover)] hover:text-primary'
                  }
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      );
    case 'add_comment':
      return (
        <div>
          <label className="mb-1 block text-[11px] font-medium text-tertiary-muted">
            Texto do comentário
          </label>
          <textarea
            value={form.action_text}
            onChange={(e) => setField('action_text', e.target.value)}
            rows={3}
            placeholder="Mensagem que será adicionada como comentário no ticket."
            className="input-premium w-full text-sm"
          />
          <p className="mt-1 text-[11px] text-tertiary-muted">
            O autor será o sistema. Para mencionar membros use @nome no texto.
          </p>
        </div>
      );
    case 'notify_member':
      return (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-tertiary-muted">
              Membro a notificar
            </label>
            <select
              value={form.action_member_id}
              onChange={(e) => setField('action_member_id', e.target.value)}
              className="input-premium w-full text-sm"
            >
              <option value="">— escolha —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-tertiary-muted">
              Mensagem (opcional)
            </label>
            <input
              type="text"
              value={form.action_message}
              onChange={(e) => setField('action_message', e.target.value)}
              placeholder="Texto curto da notificação."
              className="input-premium w-full text-sm"
            />
          </div>
        </div>
      );
  }
}

// ───────── Helpers de narrativa ─────────

function buildNarrative(
  form: FormState,
  projects: SelectItem[],
  options: OptionsBundle
): string {
  const trigger = TRIGGER_EVENTS.find((t) => t.value === form.trigger_event)?.label
    || form.trigger_event;

  const projectName = form.project_id
    ? projects.find((p) => p.id === form.project_id)?.name
    : null;
  const scope = projectName ? ` no projeto "${projectName}"` : ' em qualquer projeto';

  const condParts = form.conditions
    .filter((c) => c.field && c.value)
    .map((c) => {
      const def = CONDITION_FIELDS.find((f) => f.value === c.field);
      const label = def?.label || c.field;
      const valueLabel = labelForConditionValue(def, c.value, options);
      return `${label} é "${valueLabel}"`;
    });
  const condText = condParts.length > 0 ? ` se ${condParts.join(' e ')}` : '';

  const actionText = describeAction(form, options);

  return `${trigger}${scope}${condText}, então ${actionText}.`;
}

function labelForConditionValue(
  def: ConditionFieldDef | undefined,
  value: string,
  options: OptionsBundle
): string {
  if (!def) return value;
  if (def.kind === 'priority') {
    return PRIORITIES.find((p) => p.value === value)?.label || value;
  }
  if (def.optionType) {
    return options[def.optionType].find((o) => o.id === value)?.name || value;
  }
  return value;
}

function describeAction(form: FormState, options: OptionsBundle): string {
  switch (form.action_type) {
    case 'assign_to': {
      const m = options.members.find((x) => x.id === form.action_member_id);
      return `atribuir o ticket para ${m ? m.name : '— escolha um membro —'}`;
    }
    case 'set_priority': {
      const p = PRIORITIES.find((x) => x.value === form.action_priority);
      return `definir a prioridade como ${p ? p.label : form.action_priority}`;
    }
    case 'add_comment': {
      const text = form.action_text.trim();
      return text ? `adicionar um comentário: "${truncate(text, 60)}"` : 'adicionar um comentário';
    }
    case 'notify_member': {
      const m = options.members.find((x) => x.id === form.action_member_id);
      return `notificar ${m ? m.name : '— escolha um membro —'}`;
    }
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
