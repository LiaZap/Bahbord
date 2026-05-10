'use client';

import { Wrench } from 'lucide-react';
import Step from './Step';
import {
  ACTION_TYPES,
  PRIORITIES,
  type ActionType,
  type FormState,
  type SelectItem,
} from './types';

interface Props {
  form: FormState;
  members: SelectItem[];
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}

/** Passo 3 — Faça (ação executada quando gatilho/condições batem). */
export default function ActionStep({ form, members, setField }: Props): JSX.Element {
  return (
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
          members={members}
        />
      </div>
    </Step>
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
}): JSX.Element {
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
