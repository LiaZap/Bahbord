'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { routes } from '@/lib/utils/nav';
import type { InboxItem, OptionItem } from './types';

interface InboxAcceptModalProps {
  item: InboxItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAccepted: (itemId: string, ticketId: string) => void;
  projects: OptionItem[];
  members: OptionItem[];
  ticketTypes: OptionItem[];
  statuses: OptionItem[];
}

const PRIORITIES = [
  { id: 'urgent', label: 'Urgente' },
  { id: 'high', label: 'Alta' },
  { id: 'medium', label: 'Média' },
  { id: 'low', label: 'Baixa' },
];

const labelClass =
  'mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-secondary-muted';
const inputClass = 'input-premium w-full';

export default function InboxAcceptModal({
  item,
  isOpen,
  onClose,
  onAccepted,
  projects,
  members,
  ticketTypes,
  statuses,
}: InboxAcceptModalProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [projectId, setProjectId] = useState('');
  const [boards, setBoards] = useState<OptionItem[]>([]);
  const [boardId, setBoardId] = useState('');
  const [statusId, setStatusId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset form whenever item changes
  useEffect(() => {
    if (!item) return;
    const ai = item.ai_suggestion;
    setProjectId(ai?.suggested_project_id || '');
    setBoardId('');
    setStatusId(statuses[0]?.id || '');
    setTypeId(ticketTypes[0]?.id || '');
    setPriority(ai?.priority || 'medium');
    setAssigneeId(ai?.suggested_assignee_id || '');
    setTitle(item.title || '');
    setDescription(item.description || '');
    setError('');
  }, [item, statuses, ticketTypes]);

  // Load boards when project changes
  useEffect(() => {
    let cancelled = false;
    if (!projectId) {
      setBoards([]);
      setBoardId('');
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/boards?project_id=${projectId}`);
        if (!res.ok) return;
        const data = (await res.json()) as OptionItem[];
        if (cancelled) return;
        setBoards(data);
        const def = data.find((b) => b.is_default) || data[0];
        if (def) setBoardId(def.id);
      } catch {
        if (!cancelled) setBoards([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!item) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!item) return;
    setError('');
    if (!projectId) {
      setError('Selecione um projeto.');
      return;
    }
    if (!title.trim()) {
      setError('Título é obrigatório.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/inbox/${item.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          board_id: boardId || undefined,
          status_id: statusId || undefined,
          type_id: typeId || undefined,
          priority,
          assignee_id: assigneeId || undefined,
          title: title.trim(),
          description: description.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Erro ao criar ticket.');
        return;
      }
      const ticketId = data?.ticket?.id as string | undefined;
      toast('Ticket criado a partir da triagem', 'success');
      onAccepted(item.id, ticketId || '');
      onClose();
      if (ticketId) {
        router.push(routes.ticket(ticketId));
      }
    } catch {
      setError('Erro de conexão.');
    } finally {
      setSubmitting(false);
    }
  }

  const ai = item.ai_suggestion;
  const hasAi = !!ai;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirmar criação do ticket"
      maxWidth="max-w-[560px]"
    >
      <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
        {hasAi && (
          <div className="flex items-start gap-2 rounded-md border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-transparent px-3 py-2">
            <Sparkles size={13} className="mt-0.5 shrink-0 text-violet-500" />
            <p className="text-[12px] leading-relaxed text-secondary-muted">
              Campos pré-preenchidos pela IA. Revise e ajuste antes de criar.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>
              Projeto <span className="text-[var(--danger)]">*</span>
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={inputClass}
            >
              <option value="">Selecione...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.prefix ? ` (${p.prefix})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Board</label>
            <select
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              className={inputClass}
              disabled={!projectId || boards.length === 0}
            >
              <option value="">
                {projectId ? 'Default do projeto' : 'Selecione projeto'}
              </option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.is_default ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Status inicial</label>
            <select
              value={statusId}
              onChange={(e) => setStatusId(e.target.value)}
              className={inputClass}
            >
              <option value="">Default</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Tipo</label>
            <select
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              className={inputClass}
            >
              <option value="">Default</option>
              {ticketTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Prioridade</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className={inputClass}
            >
              {PRIORITIES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Responsável</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className={inputClass}
            >
              <option value="">Não atribuir</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name || m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>
            Título <span className="text-[var(--danger)]">*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass + ' !text-[14px] !font-medium'}
            placeholder="Resumo do ticket"
          />
        </div>

        <div>
          <label className={labelClass}>Descrição</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass + ' min-h-[120px] resize-y leading-relaxed'}
            placeholder="Detalhes do ticket"
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--card-border)] pt-3">
          <button
            type="button"
            onClick={onClose}
            className="btn-premium btn-ghost"
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-premium btn-primary disabled:opacity-50"
            disabled={submitting}
          >
            {submitting ? 'Criando...' : 'Criar ticket'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
