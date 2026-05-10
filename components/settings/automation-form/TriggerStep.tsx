'use client';

import { Zap } from 'lucide-react';
import Step from './Step';
import {
  TRIGGER_EVENTS,
  type FormState,
  type SelectItem,
  type TriggerEvent,
} from './types';

interface Props {
  form: FormState;
  projects: SelectItem[];
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}

/** Passo 1 — Quando (gatilho + escopo de projeto). */
export default function TriggerStep({ form, projects, setField }: Props): JSX.Element {
  return (
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
  );
}
