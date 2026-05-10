'use client';

import { Filter, Plus, Trash2 } from 'lucide-react';
import Step from './Step';
import {
  CONDITION_FIELDS,
  PRIORITIES,
  type ConditionField,
  type ConditionFieldDef,
  type ConditionRow,
  type FormState,
  type OptionsBundle,
} from './types';

interface Props {
  form: FormState;
  options: OptionsBundle;
  addCondition: () => void;
  updateCondition: (uid: string, patch: Partial<ConditionRow>) => void;
  removeCondition: (uid: string) => void;
}

/** Passo 2 — Se (condições combinadas com E lógico). */
export default function ConditionsStep({
  form,
  options,
  addCondition,
  updateCondition,
  removeCondition,
}: Props): JSX.Element {
  return (
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
}): JSX.Element {
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
