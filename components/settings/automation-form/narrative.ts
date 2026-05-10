/**
 * Helpers de narrativa puros (sem JSX) — descrevem em texto humano o que
 * a automação fará, baseado no FormState atual. Usado pelo banner do modal.
 */

import {
  CONDITION_FIELDS,
  PRIORITIES,
  TRIGGER_EVENTS,
  type ConditionFieldDef,
  type FormState,
  type OptionsBundle,
  type SelectItem,
} from './types';

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function labelForConditionValue(
  def: ConditionFieldDef | undefined,
  value: string,
  options: OptionsBundle,
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

export function describeAction(form: FormState, options: OptionsBundle): string {
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

export function buildNarrative(
  form: FormState,
  projects: SelectItem[],
  options: OptionsBundle,
): string {
  const trigger =
    TRIGGER_EVENTS.find((t) => t.value === form.trigger_event)?.label || form.trigger_event;

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
