'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, X, Clock, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import Avatar from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';

interface ApprovalRequest {
  id: string;
  type: string;
  status: string;
  request_data: Record<string, string>;
  requester_name: string;
  requester_email: string;
  reviewer_name: string | null;
  reviewer_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

type StatusFilter = 'pending' | 'approved' | 'rejected';

const typeLabels: Record<string, string> = {
  project_creation: 'Criar Projeto',
  project_access: 'Acesso a Projeto',
  board_access: 'Acesso a Board',
  org_access: 'Acesso à Organização',
};

export default function ApprovalsSettings() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [projects, setProjects] = useState<Array<{ id: string; name: string; prefix: string }>>([]);
  const [boards, setBoards] = useState<Array<{ id: string; name: string; project_id: string }>>([]);
  const [approvalConfig, setApprovalConfig] = useState<Record<string, { board_id?: string; project_id?: string; role?: string }>>({});

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/approvals?status=${filter}`);
      if (res.ok) setRequests(await res.json());
    } catch (err) { console.error('Erro ao carregar aprovações:', err); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // Carregar projetos e boards para seleção na aprovação
  useEffect(() => {
    fetch('/api/projects').then((r) => r.json()).then(setProjects).catch(() => {});
    fetch('/api/options?type=boards').then((r) => r.json()).then(setBoards).catch(() => {});
  }, []);

  async function handleAction(id: string, action: 'approve' | 'reject') {
    const note = action === 'reject' ? prompt('Motivo da rejeição (opcional):') : null;
    const config = approvalConfig[id] || {};
    try {
      const res = await fetch('/api/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, reviewer_note: note, ...config }),
      });
      if (res.ok) {
        toast(action === 'approve' ? 'Aprovado com sucesso' : 'Rejeitado', action === 'approve' ? 'success' : 'info');
        await fetchRequests();
      }
    } catch {
      toast('Erro ao processar', 'error');
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Aprovações</h2>
        <div className="flex items-center gap-1 rounded-lg border border-border/40 bg-surface p-0.5">
          {(['pending', 'approved', 'rejected'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition',
                filter === s ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'
              )}
            >
              {s === 'pending' ? 'Pendentes' : s === 'approved' ? 'Aprovados' : 'Rejeitados'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : requests.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-500">
          Nenhum pedido {filter === 'pending' ? 'pendente' : filter === 'approved' ? 'aprovado' : 'rejeitado'}
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r.id} className="rounded-lg border border-border/40 bg-surface2 p-4">
              <div className="flex items-start gap-3">
                <Avatar name={r.requester_name} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{r.requester_name}</span>
                    <span className="text-[11px] text-slate-500">{r.requester_email}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                      {typeLabels[r.type] || r.type}
                    </span>
                    <span className="text-[11px] text-slate-500">{formatDate(r.created_at)}</span>
                  </div>

                  {/* Request details */}
                  {r.request_data && Object.keys(r.request_data).length > 0 && (
                    <div className="mt-2 rounded bg-white/[0.02] px-3 py-2 text-[12px] text-slate-400">
                      {r.request_data.name && <p><strong>Nome:</strong> {r.request_data.name}</p>}
                      {r.request_data.prefix && <p><strong>Prefixo:</strong> {r.request_data.prefix}</p>}
                      {r.request_data.description && <p><strong>Descrição:</strong> {r.request_data.description}</p>}
                    </div>
                  )}

                  {/* Reviewer info */}
                  {r.reviewed_at && (
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                      {r.status === 'approved' ? <CheckCircle size={12} className="text-emerald-400" /> : <XCircle size={12} className="text-red-400" />}
                      <span>
                        {r.status === 'approved' ? 'Aprovado' : 'Rejeitado'} por {r.reviewer_name || 'Admin'}
                        {r.reviewer_note && ` — "${r.reviewer_note}"`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action buttons + assignment (only for pending) */}
                {r.status === 'pending' && (
                  <div className="shrink-0 space-y-2">
                    {/* Seletor de board/projeto para direcionar acesso */}
                    {(r.type === 'board_access' || r.type === 'org_access') && (
                      <div className="space-y-1">
                        <select
                          value={approvalConfig[r.id]?.project_id || ''}
                          onChange={(e) => {
                            setApprovalConfig((prev) => ({ ...prev, [r.id]: { ...prev[r.id], project_id: e.target.value, board_id: '' } }));
                          }}
                          className="w-full rounded border border-white/[0.08] bg-[var(--modal-bg)] px-2 py-1 text-[11px] text-slate-300 outline-none"
                        >
                          <option value="">Selecionar projeto...</option>
                          {projects.map((p) => <option key={p.id} value={p.id}>{p.prefix} - {p.name}</option>)}
                        </select>
                        {approvalConfig[r.id]?.project_id && (
                          <select
                            value={approvalConfig[r.id]?.board_id || ''}
                            onChange={(e) => setApprovalConfig((prev) => ({ ...prev, [r.id]: { ...prev[r.id], board_id: e.target.value } }))}
                            className="w-full rounded border border-white/[0.08] bg-[var(--modal-bg)] px-2 py-1 text-[11px] text-slate-300 outline-none"
                          >
                            <option value="">Selecionar board...</option>
                            {boards.filter((b) => b.project_id === approvalConfig[r.id]?.project_id).map((b) => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                        )}
                        <select
                          value={approvalConfig[r.id]?.role || 'viewer'}
                          onChange={(e) => setApprovalConfig((prev) => ({ ...prev, [r.id]: { ...prev[r.id], role: e.target.value } }))}
                          className="w-full rounded border border-white/[0.08] bg-[var(--modal-bg)] px-2 py-1 text-[11px] text-slate-300 outline-none"
                        >
                          <option value="viewer">Viewer (somente leitura)</option>
                          <option value="member">Member (criar tickets)</option>
                          <option value="admin">Admin (gerenciar)</option>
                        </select>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleAction(r.id, 'approve')}
                        className="flex items-center gap-1 rounded bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/25"
                      >
                        <Check size={13} />
                        Aprovar
                      </button>
                      <button
                        onClick={() => handleAction(r.id, 'reject')}
                        className="flex items-center gap-1 rounded bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20"
                      >
                        <X size={13} />
                        Rejeitar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
