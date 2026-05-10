'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, X, CheckCircle, XCircle, Briefcase, Layout, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import Avatar from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';

interface ApprovalRequest {
  id: string;
  type: string;
  status: string;
  request_data: Record<string, string>;
  requester_name: string;
  requester_email: string;
  requester_avatar: string | null;
  reviewer_name: string | null;
  reviewer_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  board_name: string | null;
  project_name: string | null;
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
  const { confirm: doConfirm } = useConfirm();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [projects, setProjects] = useState<Array<{ id: string; name: string; prefix: string }>>([]);
  const [boards, setBoards] = useState<Array<{ id: string; name: string; project_id: string }>>([]);
  const [approvalConfig, setApprovalConfig] = useState<Record<string, { board_id?: string; project_id?: string; role?: string; projects?: Array<{ project_id: string; role: string }> }>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/approvals?status=${filter}`);
      if (res.ok) setRequests(await res.json());
    } catch (err) { console.error('Erro ao carregar aprovações:', err); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // Limpar selecionados ao mudar filtro
  useEffect(() => { setSelectedIds(new Set()); }, [filter]);

  // Carregar projetos e boards para seleção na aprovação
  useEffect(() => {
    fetch('/api/projects').then((r) => r.json()).then(setProjects).catch(() => {});
    fetch('/api/options?type=boards').then((r) => r.json()).then(setBoards).catch(() => {});
  }, []);

  function addProjectToApproval(approvalId: string, projectId: string) {
    if (!projectId) return;
    setApprovalConfig((prev) => {
      const current = prev[approvalId]?.projects || [];
      if (current.find((p) => p.project_id === projectId)) return prev;
      return {
        ...prev,
        [approvalId]: { ...prev[approvalId], projects: [...current, { project_id: projectId, role: 'member' }] },
      };
    });
  }

  function removeProjectFromApproval(approvalId: string, projectId: string) {
    setApprovalConfig((prev) => {
      const current = prev[approvalId]?.projects || [];
      return {
        ...prev,
        [approvalId]: { ...prev[approvalId], projects: current.filter((p) => p.project_id !== projectId) },
      };
    });
  }

  function changeProjectRole(approvalId: string, projectId: string, role: string) {
    setApprovalConfig((prev) => {
      const current = prev[approvalId]?.projects || [];
      return {
        ...prev,
        [approvalId]: {
          ...prev[approvalId],
          projects: current.map((p) => (p.project_id === projectId ? { ...p, role } : p)),
        },
      };
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const pendingIds = requests.filter((r) => r.status === 'pending').map((r) => r.id);
    if (selectedIds.size === pendingIds.length && pendingIds.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingIds));
    }
  }

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

  async function handleBulkApprove() {
    if (selectedIds.size === 0) return;
    const ok = await doConfirm({ title: 'Aprovar pedidos', message: `Aprovar ${selectedIds.size} pedido(s) selecionado(s)?`, variant: 'info', confirmText: 'Aprovar' });
    if (!ok) return;

    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      const config = approvalConfig[id] || {};
      try {
        const res = await fetch('/api/approvals', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, action: 'approve', ...config }),
        });
        if (res.ok) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) {
      toast(`${successCount} pedido(s) aprovado(s)${failCount > 0 ? `, ${failCount} falharam` : ''}`, failCount > 0 ? 'info' : 'success');
    } else {
      toast('Nenhum pedido foi aprovado', 'error');
    }

    setSelectedIds(new Set());
    setBulkLoading(false);
    await fetchRequests();
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function renderContext(r: ApprovalRequest) {
    if (r.type === 'org_access') {
      return (
        <p className="flex items-center gap-1.5 text-[12px] text-slate-300">
          <Building2 size={12} className="text-slate-500" />
          Acesso geral à organização
        </p>
      );
    }
    if (r.request_data?.board_id) {
      return (
        <p className="flex items-center gap-1.5 text-[12px] text-slate-300">
          <Layout size={12} className="text-slate-500" />
          Acesso ao board: <strong className="font-semibold text-white">{r.board_name || 'Desconhecido'}</strong>
        </p>
      );
    }
    if (r.request_data?.project_id) {
      return (
        <p className="flex items-center gap-1.5 text-[12px] text-slate-300">
          <Briefcase size={12} className="text-slate-500" />
          Acesso ao projeto: <strong className="font-semibold text-white">{r.project_name || 'Desconhecido'}</strong>
        </p>
      );
    }
    return null;
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const allSelected = pendingCount > 0 && selectedIds.size === pendingCount;

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

      {/* Barra de ação em lote (apenas para pendentes) */}
      {filter === 'pending' && pendingCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-border/40 bg-surface px-3 py-2">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="h-3.5 w-3.5 accent-accent cursor-pointer"
            />
            {selectedIds.size > 0
              ? `${selectedIds.size} selecionado(s)`
              : 'Selecionar todos'}
          </label>
          <button
            onClick={handleBulkApprove}
            disabled={selectedIds.size === 0 || bulkLoading}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition',
              selectedIds.size === 0 || bulkLoading
                ? 'cursor-not-allowed bg-white/[0.04] text-slate-600'
                : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
            )}
          >
            {bulkLoading ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            ) : (
              <Check size={13} />
            )}
            Aprovar Selecionados
          </button>
        </div>
      )}

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
            <div
              key={r.id}
              className={cn(
                'rounded-lg border p-4 transition',
                selectedIds.has(r.id)
                  ? 'border-accent/50 bg-accent/[0.04]'
                  : 'border-border/40 bg-surface2'
              )}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox para seleção em lote */}
                {r.status === 'pending' && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(r.id)}
                    onChange={() => toggleSelect(r.id)}
                    className="mt-1.5 h-3.5 w-3.5 accent-accent cursor-pointer"
                  />
                )}

                <Avatar name={r.requester_name} imageUrl={r.requester_avatar} size="md" />
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

                  {/* Contexto (projeto/board/org) */}
                  <div className="mt-2">{renderContext(r)}</div>

                  {/* Request details */}
                  {r.request_data && Object.keys(r.request_data).length > 0 && (
                    (r.request_data.name || r.request_data.prefix || r.request_data.description) && (
                      <div className="mt-2 rounded bg-white/[0.02] px-3 py-2 text-[12px] text-slate-400">
                        {r.request_data.name && <p><strong>Nome:</strong> {r.request_data.name}</p>}
                        {r.request_data.prefix && <p><strong>Prefixo:</strong> {r.request_data.prefix}</p>}
                        {r.request_data.description && <p><strong>Descrição:</strong> {r.request_data.description}</p>}
                      </div>
                    )
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
                    {/* Multi-projetos pra org_access */}
                    {r.type === 'org_access' && (
                      <div className="space-y-1.5 min-w-[280px]">
                        <p className="text-[10px] uppercase tracking-wider text-secondary">Atribuir a projetos (opcional)</p>
                        {(approvalConfig[r.id]?.projects || []).map((pj) => {
                          const proj = projects.find((p) => p.id === pj.project_id);
                          return (
                            <div key={pj.project_id} className="flex items-center gap-1 rounded border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-2 py-1">
                              <span className="flex-1 truncate text-[11px] text-primary">{proj?.prefix} · {proj?.name}</span>
                              <select
                                value={pj.role}
                                onChange={(e) => changeProjectRole(r.id, pj.project_id, e.target.value)}
                                className="rounded border border-[var(--card-border)] bg-[var(--modal-bg)] px-1.5 py-0.5 text-[10px] text-primary outline-none"
                              >
                                <option value="viewer">Viewer</option>
                                <option value="member">Member</option>
                                <option value="admin">Admin</option>
                              </select>
                              <button
                                onClick={() => removeProjectFromApproval(r.id, pj.project_id)}
                                className="rounded p-0.5 text-secondary hover:bg-[var(--overlay-hover)] hover:text-[var(--danger)]"
                                aria-label="Remover"
                                title="Remover"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          );
                        })}
                        <select
                          value=""
                          onChange={(e) => addProjectToApproval(r.id, e.target.value)}
                          className="w-full rounded border border-[var(--card-border)] bg-[var(--modal-bg)] px-2 py-1 text-[11px] text-secondary outline-none"
                        >
                          <option value="">+ Adicionar projeto…</option>
                          {projects
                            .filter((p) => !(approvalConfig[r.id]?.projects || []).find((pj) => pj.project_id === p.id))
                            .map((p) => (
                              <option key={p.id} value={p.id}>{p.prefix} — {p.name}</option>
                            ))}
                        </select>
                        <select
                          value={approvalConfig[r.id]?.role || 'member'}
                          onChange={(e) => setApprovalConfig((prev) => ({ ...prev, [r.id]: { ...prev[r.id], role: e.target.value } }))}
                          className="w-full rounded border border-[var(--card-border)] bg-[var(--modal-bg)] px-2 py-1 text-[11px] text-primary outline-none"
                        >
                          <option value="member">Role na org: Member</option>
                          <option value="admin">Role na org: Admin</option>
                          <option value="viewer">Role na org: Viewer</option>
                        </select>
                      </div>
                    )}

                    {/* Pra board_access manter o seletor antigo (single board) */}
                    {r.type === 'board_access' && (
                      <div className="space-y-1">
                        <select
                          value={approvalConfig[r.id]?.project_id || ''}
                          onChange={(e) => {
                            setApprovalConfig((prev) => ({ ...prev, [r.id]: { ...prev[r.id], project_id: e.target.value, board_id: '' } }));
                          }}
                          className="w-full rounded border border-[var(--card-border)] bg-[var(--modal-bg)] px-2 py-1 text-[11px] text-primary outline-none"
                        >
                          <option value="">Selecionar projeto...</option>
                          {projects.map((p) => <option key={p.id} value={p.id}>{p.prefix} - {p.name}</option>)}
                        </select>
                        {approvalConfig[r.id]?.project_id && (
                          <select
                            value={approvalConfig[r.id]?.board_id || ''}
                            onChange={(e) => setApprovalConfig((prev) => ({ ...prev, [r.id]: { ...prev[r.id], board_id: e.target.value } }))}
                            className="w-full rounded border border-[var(--card-border)] bg-[var(--modal-bg)] px-2 py-1 text-[11px] text-primary outline-none"
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
                          className="w-full rounded border border-[var(--card-border)] bg-[var(--modal-bg)] px-2 py-1 text-[11px] text-primary outline-none"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
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
