'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, GitCommit } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Avatar from '@/components/ui/Avatar';
import { cn } from '@/lib/utils/cn';
import { useProject } from '@/lib/project-context';

interface ChangelogEntry {
  id: string;
  member_name: string;
  entity_type: string;
  entity_name: string | null;
  action: string;
  details: Record<string, unknown>;
  commit_hash: string | null;
  created_at: string;
}

type FilterType = 'all' | 'ticket' | 'member' | 'board' | 'project';

interface ChangelogPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const actionLabels: Record<string, string> = {
  created: 'criou',
  updated: 'atualizou',
  deleted: 'removeu',
  archived: 'arquivou',
  status_changed: 'mudou status de',
  commented: 'comentou em',
  assigned: 'atribuiu',
};

export default function ChangelogPanel({ isOpen, onClose }: ChangelogPanelProps) {
  const { currentProjectId } = useProject();
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);

  const fetchChangelog = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (currentProjectId) params.set('project_id', currentProjectId);
      if (filter !== 'all') params.set('entity_type', filter);
      const res = await fetch(`/api/changelog?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(Array.isArray(data) ? data : data.data || []);
      }
    } catch (err) { console.error('Erro ao carregar changelog:', err); }
    finally { setLoading(false); }
  }, [currentProjectId, filter]);

  useEffect(() => { if (isOpen) fetchChangelog(); }, [isOpen, fetchChangelog]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="h-full w-[400px] border-l border-white/[0.06] bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-white">Changelog</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300">
            <X size={16} />
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1 border-b border-white/[0.04] px-5 py-2">
          {(['all', 'ticket', 'member', 'board'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-full px-3 py-1 text-[11px] font-medium transition',
                filter === f ? 'bg-accent/15 text-accent' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {f === 'all' ? 'Tudo' : f === 'ticket' ? 'Tickets' : f === 'member' ? 'Membros' : 'Boards'}
            </button>
          ))}
        </div>

        {/* Entries */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          ) : entries.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">Nenhuma atividade registrada</p>
          ) : (
            <div className="space-y-4">
              {entries.map((e) => (
                <div key={e.id} className="flex gap-3">
                  <Avatar name={e.member_name || 'Sistema'} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-slate-300">
                      <span className="font-medium text-white">{e.member_name || 'Sistema'}</span>
                      {' '}{actionLabels[e.action] || e.action}{' '}
                      <span className="font-medium text-slate-200">{e.entity_type}</span>
                      {e.entity_name && <span className="text-accent"> {e.entity_name}</span>}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                      {e.commit_hash && (
                        <span className="flex items-center gap-1 font-mono text-slate-400">
                          <GitCommit size={10} />
                          {e.commit_hash.substring(0, 7)}
                        </span>
                      )}
                      <span>
                        {(() => { try { return formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: ptBR }); } catch { return e.created_at; } })()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
