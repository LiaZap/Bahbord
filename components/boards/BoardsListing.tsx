'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronRight, Plus, Columns3, Zap, Layout } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useProject } from '@/lib/project-context';

interface BoardItem {
  id: string;
  name: string;
  type: string;
  project_id: string;
  project_name: string;
  project_color: string;
  project_prefix: string;
  ticket_count: number;
}

const typeBadge: Record<string, { label: string; icon: typeof Columns3; color: string }> = {
  kanban: { label: 'Kanban', icon: Columns3, color: 'bg-blue-500/20 text-blue-400' },
  scrum: { label: 'Scrum', icon: Zap, color: 'bg-purple-500/20 text-purple-400' },
  simple: { label: 'Simples', icon: Layout, color: 'bg-slate-500/20 text-slate-400' },
};

export default function BoardsListing({ boards }: { boards: BoardItem[] }) {
  const router = useRouter();
  const { setProject, setBoard, addRecentBoard } = useProject();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState<string | null>(null);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardType, setNewBoardType] = useState('kanban');

  const filtered = boards.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.project_name.toLowerCase().includes(search.toLowerCase())
  );

  // Group by project
  const grouped = filtered.reduce<Record<string, { project: { id: string; name: string; color: string; prefix: string }; boards: BoardItem[] }>>((acc, b) => {
    if (!acc[b.project_id]) {
      acc[b.project_id] = {
        project: { id: b.project_id, name: b.project_name, color: b.project_color, prefix: b.project_prefix },
        boards: [],
      };
    }
    acc[b.project_id].boards.push(b);
    return acc;
  }, {});

  function handleBoardClick(board: BoardItem) {
    setProject(board.project_id);
    setBoard(board.id);
    addRecentBoard({ id: board.id, name: board.name, projectName: board.project_name });
    router.push('/board');
  }

  async function handleCreateBoard(projectId: string) {
    if (!newBoardName.trim()) return;
    try {
      await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, name: newBoardName.trim(), type: newBoardType }),
      });
      setCreating(null);
      setNewBoardName('');
      setNewBoardType('kanban');
      router.refresh();
    } catch {}
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Todos os Boards</h1>
      </div>

      {/* Search */}
      <div className="mb-5">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Filtrar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] py-2 pl-9 pr-3 text-[13px] text-slate-300 placeholder-slate-600 outline-none transition focus:border-blue-500/50 focus:bg-white/[0.05]"
          />
        </div>
      </div>

      {/* Grouped boards */}
      <div className="space-y-3">
        {Object.entries(grouped).map(([projectId, { project, boards: projectBoards }]) => {
          const isCollapsed = collapsed[projectId] ?? false;
          return (
            <div key={projectId} className="rounded-lg border border-white/[0.06] bg-white/[0.02]">
              {/* Project header */}
              <button
                onClick={() => setCollapsed((prev) => ({ ...prev, [projectId]: !isCollapsed }))}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.02]"
              >
                <ChevronRight
                  size={14}
                  className={cn('text-slate-500 transition-transform', !isCollapsed && 'rotate-90')}
                />
                <span
                  className="flex h-6 w-6 items-center justify-center rounded text-[9px] font-bold text-white"
                  style={{ backgroundColor: project.color }}
                >
                  {project.prefix.substring(0, 2)}
                </span>
                <span className="flex-1 text-[13px] font-semibold text-white">{project.name}</span>
                <span className="text-[11px] text-slate-500">
                  {projectBoards.length} board{projectBoards.length !== 1 ? 's' : ''}
                </span>
              </button>

              {/* Boards list */}
              {!isCollapsed && (
                <div className="border-t border-white/[0.04] px-2 py-1.5">
                  {projectBoards.map((board) => {
                    const badge = typeBadge[board.type] || typeBadge.kanban;
                    const BadgeIcon = badge.icon;
                    return (
                      <button
                        key={board.id}
                        onClick={() => handleBoardClick(board)}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition hover:bg-white/[0.04]"
                      >
                        <Columns3 size={15} className="text-slate-500" />
                        <span className="flex-1 truncate text-[13px] text-slate-300">{board.name}</span>
                        <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', badge.color)}>
                          <BadgeIcon size={10} />
                          {badge.label}
                        </span>
                        <span className="text-[11px] text-slate-600">
                          {board.ticket_count} ticket{board.ticket_count !== 1 ? 's' : ''}
                        </span>
                      </button>
                    );
                  })}

                  {/* New board inline form */}
                  {creating === projectId ? (
                    <div className="flex items-center gap-2 px-3 py-2">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Nome do board..."
                        value={newBoardName}
                        onChange={(e) => setNewBoardName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateBoard(projectId); if (e.key === 'Escape') { setCreating(null); setNewBoardName(''); } }}
                        className="flex-1 rounded border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-[12px] text-slate-300 outline-none focus:border-blue-500/50"
                      />
                      <select
                        value={newBoardType}
                        onChange={(e) => setNewBoardType(e.target.value)}
                        className="rounded border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-[11px] text-slate-400 outline-none"
                      >
                        <option value="kanban">Kanban</option>
                        <option value="scrum">Scrum</option>
                        <option value="simple">Simples</option>
                      </select>
                      <button
                        onClick={() => handleCreateBoard(projectId)}
                        className="rounded bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-blue-500"
                      >
                        Criar
                      </button>
                      <button
                        onClick={() => { setCreating(null); setNewBoardName(''); }}
                        className="text-[11px] text-slate-500 hover:text-slate-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setCreating(projectId)}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[12px] text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-300"
                    >
                      <Plus size={14} />
                      Novo board
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {Object.keys(grouped).length === 0 && (
          <div className="py-12 text-center text-[13px] text-slate-500">
            {search ? 'Nenhum board encontrado.' : 'Nenhum board cadastrado.'}
          </div>
        )}
      </div>
    </div>
  );
}
