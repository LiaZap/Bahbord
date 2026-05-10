/**
 * Tipos e catálogos compartilhados pelos sub-componentes do AutomationFormModal.
 * Quem importa: TriggerStep, ConditionsStep, ActionStep, narrative, AutomationFormModal.
 */

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
export type ConditionField =
  | 'priority'
  | 'service_id'
  | 'category_id'
  | 'ticket_type_id'
  | 'status_id'
  | 'client_id'
  | 'assignee_id';

export interface ConditionFieldDef {
  value: ConditionField;
  label: string;
  /** Tipo de UI que renderizamos para escolher o valor. */
  kind: 'priority' | 'option';
  /** Quando kind === 'option', qual recurso buscar via /api/options. */
  optionType?: 'services' | 'categories' | 'ticket_types' | 'statuses' | 'clients' | 'members';
}

export const CONDITION_FIELDS: ConditionFieldDef[] = [
  { value: 'priority', label: 'Prioridade', kind: 'priority' },
  { value: 'service_id', label: 'Serviço/Produto', kind: 'option', optionType: 'services' },
  { value: 'category_id', label: 'Categoria', kind: 'option', optionType: 'categories' },
  { value: 'ticket_type_id', label: 'Tipo de ticket', kind: 'option', optionType: 'ticket_types' },
  { value: 'status_id', label: 'Status', kind: 'option', optionType: 'statuses' },
  { value: 'client_id', label: 'Cliente', kind: 'option', optionType: 'clients' },
  { value: 'assignee_id', label: 'Responsável', kind: 'option', optionType: 'members' },
];

export const PRIORITIES: { value: string; label: string }[] = [
  { value: 'urgent', label: 'Urgente' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Média' },
  { value: 'low', label: 'Baixa' },
];

export interface ConditionRow {
  /** key estável para React (não vai pro payload) */
  uid: string;
  field: ConditionField | '';
  value: string;
}

export interface FormState {
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

export interface OptionsBundle {
  services: SelectItem[];
  categories: SelectItem[];
  ticket_types: SelectItem[];
  statuses: SelectItem[];
  clients: SelectItem[];
  members: SelectItem[];
}

export const EMPTY_OPTIONS: OptionsBundle = {
  services: [],
  categories: [],
  ticket_types: [],
  statuses: [],
  clients: [],
  members: [],
};

export interface OptionRow {
  id: string;
  name?: string;
  display_name?: string;
}

export function makeUid(): string {
  return `c_${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyForm(): FormState {
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

export function fromAutomation(a: Automation): FormState {
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
