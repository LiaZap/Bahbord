'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import type {
  RoadmapInitiative,
  RoadmapMember,
  RoadmapProject,
  HealthStatus,
} from './RoadmapView';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (initiative: RoadmapInitiative) => void;
  projects: RoadmapProject[];
  members: RoadmapMember[];
  initiative: RoadmapInitiative | null;
}

const COLOR_PRESETS: string[] = [
  '#3b6cf5',
  '#22c55e',
  '#ef4444',
  '#a855f7',
  '#f97316',
  '#06b6d4',
  '#eab308',
  '#ec4899',
  '#14b8a6',
  '#64748b',
];

const ICON_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'target', label: 'Target' },
  { key: 'rocket', label: 'Rocket' },
  { key: 'trending-up', label: 'TrendingUp' },
  { key: 'star', label: 'Star' },
  { key: 'flag', label: 'Flag' },
  { key: 'trophy', label: 'Trophy' },
  { key: 'sparkles', label: 'Sparkles' },
  { key: 'zap', label: 'Zap' },
];

const HEALTH_OPTIONS: Array<{ key: HealthStatus; label: string }> = [
  { key: 'on_track', label: 'No prazo' },
  { key: 'at_risk', label: 'Em risco' },
  { key: 'off_track', label: 'Atrasado' },
  { key: 'completed', label: 'Concluído' },
  { key: 'archived', label: 'Arquivado' },
];

function isHealth(value: string): value is HealthStatus {
  return value === 'on_track' || value === 'at_risk' || value === 'off_track' || value === 'completed' || value === 'archived';
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export default function InitiativeFormModal({
  isOpen,
  onClose,
  onSaved,
  projects,
  members,
  initiative,
}: Props): JSX.Element {
  const { toast } = useToast();
  const isEdit = initiative !== null;

  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [goal, setGoal] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>('');
  const [color, setColor] = useState<string>(COLOR_PRESETS[0]);
  const [icon, setIcon] = useState<string>('target');
  const [iconCustom, setIconCustom] = useState<string>('');
  const [ownerId, setOwnerId] = useState<string>('');
  const [health, setHealth] = useState<HealthStatus>('on_track');
  const [healthNote, setHealthNote] = useState<string>('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [projectSearch, setProjectSearch] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Reset / hidrata estado quando abre o modal
  useEffect(() => {
    if (!isOpen) return;
    if (initiative) {
      setName(initiative.name);
      setDescription(initiative.description ?? '');
      setGoal(initiative.goal ?? '');
      setStartDate(toDateInputValue(initiative.start_date));
      setTargetDate(toDateInputValue(initiative.target_date));
      setColor(initiative.color ?? COLOR_PRESETS[0]);
      const iconKey = initiative.icon ?? 'target';
      const isPreset = ICON_OPTIONS.some((o) => o.key === iconKey);
      setIcon(isPreset ? iconKey : 'custom');
      setIconCustom(isPreset ? '' : iconKey);
      setOwnerId(initiative.owner_id ?? '');
      setHealth(isHealth(initiative.health) ? initiative.health : 'on_track');
      setHealthNote(initiative.health_note ?? '');
      setSelectedProjectIds(initiative.projects.map((p) => p.project_id));
    } else {
      setName('');
      setDescription('');
      setGoal('');
      setStartDate('');
      setTargetDate('');
      setColor(COLOR_PRESETS[0]);
      setIcon('target');
      setIconCustom('');
      setOwnerId('');
      setHealth('on_track');
      setHealthNote('');
      setSelectedProjectIds([]);
    }
    setProjectSearch('');
  }, [isOpen, initiative]);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.prefix.toLowerCase().includes(q),
    );
  }, [projects, projectSearch]);

  function toggleProject(id: string) {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast('Nome é obrigatório', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const finalIcon = icon === 'custom' ? iconCustom.trim() || null : icon;

      // POST: endpoint não aceita health no create — herda 'on_track' do default DB.
      // Se usuário escolheu health diferente no create, fazemos PATCH em seguida.
      if (!isEdit) {
        const createBody = {
          name: name.trim(),
          description: description.trim() || undefined,
          goal: goal.trim() || undefined,
          start_date: startDate || undefined,
          target_date: targetDate || undefined,
          color,
          icon: finalIcon ?? undefined,
          owner_id: ownerId || undefined,
          project_ids: selectedProjectIds.length > 0 ? selectedProjectIds : undefined,
        };
        const res = await fetch('/api/initiatives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createBody),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          toast(err.error ?? 'Erro ao criar', 'error');
          return;
        }
        let saved = (await res.json()) as RoadmapInitiative;

        // Se health mudou em relação ao default, faz patch
        if (health !== 'on_track' || healthNote.trim()) {
          const patchRes = await fetch(`/api/initiatives/${saved.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              health,
              health_note: healthNote.trim() || null,
            }),
          });
          if (patchRes.ok) {
            const patched = (await patchRes.json()) as RoadmapInitiative;
            saved = { ...saved, ...patched, projects: saved.projects };
          }
        }

        onSaved({ ...saved, projects: saved.projects ?? [] });
        toast('Iniciativa criada', 'success');
        onClose();
        return;
      }

      // EDIT
      const patchBody: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || null,
        goal: goal.trim() || null,
        start_date: startDate || null,
        target_date: targetDate || null,
        color,
        icon: finalIcon,
        owner_id: ownerId || null,
        project_ids: selectedProjectIds,
      };
      if (initiative && health !== initiative.health) {
        patchBody.health = health;
        patchBody.health_note = healthNote.trim() || null;
      } else if (
        initiative &&
        (healthNote.trim() || '') !== (initiative.health_note ?? '')
      ) {
        patchBody.health_note = healthNote.trim() || null;
      }

      const res = await fetch(`/api/initiatives/${initiative!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast(err.error ?? 'Erro ao salvar', 'error');
        return;
      }
      const updated = (await res.json()) as RoadmapInitiative;
      // Endpoint PATCH não retorna projects[]; mesclamos com a lista escolhida.
      const mergedProjects = selectedProjectIds
        .map((pid) => projects.find((p) => p.id === pid))
        .filter((p): p is RoadmapProject => Boolean(p))
        .map((p) => ({
          project_id: p.id,
          name: p.name,
          prefix: p.prefix,
          color: p.color,
        }));
      onSaved({ ...updated, projects: mergedProjects });
      toast('Iniciativa atualizada', 'success');
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  const showHealthNote = health !== 'on_track';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Editar iniciativa' : 'Nova iniciativa'} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-5 px-5 py-4">
        {/* Name */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-tertiary-muted">
            Nome <span className="text-red-500">*</span>
          </label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            placeholder="Ex: Reduzir tempo de resposta"
            className="w-full rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-3 py-2 text-[13px] text-primary outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Goal + Description */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-tertiary-muted">Goal</label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Ex: Reduzir churn em 20%"
              className="w-full rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-3 py-2 text-[13px] text-primary outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-tertiary-muted">
              Owner
            </label>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="w-full rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-3 py-2 text-[13px] text-primary outline-none focus:border-[var(--accent)]"
            >
              <option value="">Sem owner</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-tertiary-muted">
            Descrição
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Contexto e escopo da iniciativa"
            className="w-full resize-y rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-3 py-2 text-[13px] text-primary outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Datas */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-tertiary-muted">
              Início
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-3 py-2 text-[13px] text-primary outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-tertiary-muted">
              Prazo
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-3 py-2 text-[13px] text-primary outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {/* Color picker */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-tertiary-muted">Cor</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  'h-7 w-7 rounded-md border-2 transition',
                  color === c ? 'border-[var(--accent)] scale-110' : 'border-transparent',
                )}
                style={{ backgroundColor: c }}
                aria-label={`Cor ${c}`}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-7 w-7 cursor-pointer rounded-md border-0 bg-transparent"
              aria-label="Cor customizada"
            />
          </div>
        </div>

        {/* Icon picker */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-tertiary-muted">Ícone</label>
          <div className="flex flex-wrap items-center gap-1.5">
            {ICON_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setIcon(opt.key)}
                className={cn(
                  'rounded-md border px-2 py-1 text-[11px] transition',
                  icon === opt.key
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'border-[var(--card-border)] text-secondary-muted hover:bg-[var(--overlay-subtle)] hover:text-primary',
                )}
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIcon('custom')}
              className={cn(
                'rounded-md border px-2 py-1 text-[11px] transition',
                icon === 'custom'
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--card-border)] text-secondary-muted hover:bg-[var(--overlay-subtle)] hover:text-primary',
              )}
            >
              Emoji
            </button>
            {icon === 'custom' && (
              <input
                type="text"
                value={iconCustom}
                onChange={(e) => setIconCustom(e.target.value.slice(0, 4))}
                placeholder="🎯"
                className="w-16 rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-2 py-1 text-[13px] text-primary outline-none focus:border-[var(--accent)]"
              />
            )}
          </div>
        </div>

        {/* Health */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-tertiary-muted">Health</label>
            <select
              value={health}
              onChange={(e) => {
                if (isHealth(e.target.value)) setHealth(e.target.value);
              }}
              className="w-full rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-3 py-2 text-[13px] text-primary outline-none focus:border-[var(--accent)]"
            >
              {HEALTH_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {showHealthNote && (
          <div>
            <label className="mb-1 block text-[11px] font-medium text-tertiary-muted">
              Nota do health
              <span className="ml-1 text-tertiary-muted/70">(opcional — justifique)</span>
            </label>
            <textarea
              value={healthNote}
              onChange={(e) => setHealthNote(e.target.value)}
              rows={2}
              placeholder="O que está bloqueando ou justifica esse status?"
              className="w-full resize-y rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-3 py-2 text-[13px] text-primary outline-none focus:border-[var(--accent)]"
            />
          </div>
        )}

        {/* Project picker */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-[11px] font-medium text-tertiary-muted">
              Projetos vinculados
            </label>
            <span className="text-[11px] text-tertiary-muted">
              {selectedProjectIds.length} selecionado{selectedProjectIds.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)]">
            <div className="flex items-center gap-2 border-b border-[var(--card-border)] px-2.5 py-1.5">
              <Search size={13} className="text-tertiary-muted" />
              <input
                type="text"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Buscar projeto…"
                className="flex-1 bg-transparent text-[12.5px] text-primary outline-none placeholder:text-tertiary-muted"
              />
              {projectSearch && (
                <button
                  type="button"
                  onClick={() => setProjectSearch('')}
                  className="text-tertiary-muted hover:text-primary"
                  aria-label="Limpar busca"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="max-h-44 overflow-y-auto">
              {filteredProjects.length === 0 ? (
                <p className="px-3 py-3 text-[12px] text-tertiary-muted">
                  Nenhum projeto encontrado.
                </p>
              ) : (
                filteredProjects.map((p) => {
                  const checked = selectedProjectIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[12.5px] transition',
                        checked
                          ? 'bg-[var(--accent-soft)] text-primary'
                          : 'text-secondary-muted hover:bg-[var(--overlay-subtle)] hover:text-primary',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleProject(p.id)}
                        className="rounded border-[var(--card-border)]"
                      />
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: p.color ?? '#64748b' }}
                      />
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="font-mono text-[10px] text-tertiary-muted">{p.prefix}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--card-border)] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="btn-premium btn-secondary"
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-premium btn-primary"
            disabled={submitting || !name.trim()}
          >
            {submitting ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
