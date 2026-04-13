'use client';

import { useState } from 'react';
import { Plus, Trash2, CheckSquare, Square } from 'lucide-react';
import { useSubtasks } from '@/lib/hooks/useSubtasks';
import { cn } from '@/lib/utils/cn';

interface SubtaskListProps {
  ticketId: string;
}

export default function SubtaskList({ ticketId }: SubtaskListProps) {
  const { subtasks, addSubtask, toggleSubtask, deleteSubtask } = useSubtasks(ticketId);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const doneCount = subtasks.filter((s) => s.is_completed).length;
  const total = subtasks.length;
  const progress = total > 0 ? (doneCount / total) * 100 : 0;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await addSubtask(newTitle.trim());
    setNewTitle('');
  }

  return (
    <section className="rounded-lg border border-border/40 bg-surface2 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Subtarefas {total > 0 && <span className="ml-1 text-slate-400">{doneCount}/{total}</span>}
        </h2>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-success transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Subtask list */}
      <div className="space-y-1">
        {subtasks.map((sub) => (
          <div
            key={sub.id}
            className="group flex items-center gap-2 rounded px-2 py-1.5 transition hover:bg-surface"
          >
            <button
              onClick={() => toggleSubtask(sub.id, !sub.is_completed)}
              className="shrink-0 text-slate-500 transition hover:text-accent"
            >
              {sub.is_completed ? (
                <CheckSquare size={16} className="text-success" />
              ) : (
                <Square size={16} />
              )}
            </button>
            <span
              className={cn(
                'flex-1 text-sm',
                sub.is_completed ? 'text-slate-600 line-through' : 'text-slate-300'
              )}
            >
              {sub.title}
            </span>
            {sub.assignee_name && (
              <span className="text-[10px] text-slate-600">{sub.assignee_name}</span>
            )}
            <button
              onClick={() => deleteSubtask(sub.id)}
              className="shrink-0 opacity-0 transition hover:text-danger group-hover:opacity-100"
            >
              <Trash2 size={13} className="text-slate-600 hover:text-danger" />
            </button>
          </div>
        ))}
      </div>

      {/* Add subtask */}
      {adding ? (
        <form onSubmit={handleAdd} className="mt-2 flex gap-2">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onBlur={() => { if (!newTitle.trim()) setAdding(false); }}
            placeholder="Título da subtarefa"
            className="flex-1 rounded border border-border/40 bg-surface px-2.5 py-1.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-accent/60"
          />
          <button
            type="submit"
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500"
          >
            Adicionar
          </button>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-2 flex items-center gap-1 text-xs text-slate-500 transition hover:text-accent"
        >
          <Plus size={14} />
          Adicionar subtarefa
        </button>
      )}
    </section>
  );
}
