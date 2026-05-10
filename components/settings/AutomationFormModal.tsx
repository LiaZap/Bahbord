'use client';

import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import TriggerStep from './automation-form/TriggerStep';
import ConditionsStep from './automation-form/ConditionsStep';
import ActionStep from './automation-form/ActionStep';
import { buildNarrative } from './automation-form/narrative';
import {
  CONDITION_FIELDS,
  EMPTY_OPTIONS,
  emptyForm,
  fromAutomation,
  makeUid,
  type Automation,
  type ConditionRow,
  type FormState,
  type OptionRow,
  type OptionsBundle,
  type SelectItem,
} from './automation-form/types';

// Re-export pra preservar API externa do módulo (callers importam estes
// símbolos direto do AutomationFormModal — ex.: AutomationsSettings).
export { ACTION_TYPES, TRIGGER_EVENTS } from './automation-form/types';
export type { Automation, SelectItem } from './automation-form/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: Automation | null;
  projects: SelectItem[];
}

/**
 * Modal de criação/edição de Automation. Orquestra os 3 steps (Quando/Se/Faça)
 * e centraliza estado, validação e persistência. A lógica visual de cada passo
 * mora em ./automation-form/{TriggerStep,ConditionsStep,ActionStep}.
 */
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
          types.map((t) => fetch(`/api/options?type=${t}`).then((r) => (r.ok ? r.json() : []))),
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
  const narrative = useMemo(
    () => buildNarrative(form, projects, options),
    [form, projects, options],
  );

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
    // CONDITION_FIELDS é importado pra garantir que o catálogo é o mesmo
    // usado pelos sub-componentes; também serve como anti-tree-shake guard
    // caso futuras condições precisem validar o `field` antes de persistir.
    void CONDITION_FIELDS;

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

        <TriggerStep form={form} projects={projects} setField={setField} />

        <ConditionsStep
          form={form}
          options={options}
          addCondition={addCondition}
          updateCondition={updateCondition}
          removeCondition={removeCondition}
        />

        <ActionStep form={form} members={options.members} setField={setField} />

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
