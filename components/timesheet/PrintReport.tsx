'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';

interface TimeEntry {
  id: string;
  description: string | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  is_running: boolean;
  is_billable: boolean;
  member_id: string | null;
  member_name: string;
  ticket_key: string;
  ticket_title: string;
  sprint_id: string | null;
  sprint_name: string | null;
  project_name: string | null;
}

interface MemberSummary {
  member_name: string;
  total_minutes: number;
  billable_minutes: number;
  non_billable_minutes: number;
  entry_count: number;
}

interface Sprint {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

export default function PrintReport() {
  const searchParams = useSearchParams();
  const period = searchParams.get('period') || '7';
  const sprintId = searchParams.get('sprint_id') || '';
  const projectIdParam = searchParams.get('project_id') || '';
  const boardId = searchParams.get('board_id') || '';
  const billableParam = searchParams.get('billable') || 'all';

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [summary, setSummary] = useState<MemberSummary[]>([]);
  const [sprintName, setSprintName] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string>('Bah!Flow');
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Resolve projectId via board se necessário
      let projectId = projectIdParam;
      if (!projectId && boardId) {
        try {
          const bRes = await fetch('/api/options?type=boards');
          if (bRes.ok) {
            const allBoards = await bRes.json();
            const match = allBoards.find((b: { id: string; project_id: string }) => b.id === boardId);
            if (match?.project_id) projectId = match.project_id;
          }
        } catch {}
      }

      const params = new URLSearchParams({ period });
      if (projectId) params.set('project_id', projectId);
      else if (boardId) params.set('board_id', boardId);
      if (sprintId) params.set('sprint_id', sprintId);

      const [tsRes, meRes, sprintsRes, projectsRes] = await Promise.all([
        fetch(`/api/timesheet?${params}`),
        fetch('/api/auth/me'),
        sprintId ? fetch(`/api/sprints${projectId ? `?project_id=${projectId}` : ''}`) : Promise.resolve(null),
        projectId ? fetch('/api/options?type=projects') : Promise.resolve(null),
      ]);

      if (tsRes.ok) {
        const data = await tsRes.json();
        setEntries(data.entries || []);
        setSummary(data.summary || []);
      }

      if (meRes && meRes.ok) {
        const data = await meRes.json();
        if (data.workspace?.name) setWorkspaceName(data.workspace.name);
      }

      if (sprintsRes && sprintsRes.ok) {
        const allSprints: Sprint[] = await sprintsRes.json();
        const match = allSprints.find((s) => s.id === sprintId);
        if (match) setSprintName(match.name);
      }

      if (projectsRes && projectsRes.ok) {
        const allProjects: Project[] = await projectsRes.json();
        const match = allProjects.find((p) => p.id === projectId);
        if (match) setProjectName(match.name);
      }
    } catch (err) {
      console.error('Erro ao carregar relatório:', err);
    } finally {
      setLoading(false);
    }
  }, [period, sprintId, projectIdParam, boardId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Auto-trigger print quando dados carregam
  useEffect(() => {
    if (!loading && entries.length >= 0) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [loading, entries.length]);

  function formatMin(m: number | null | undefined): string {
    if (!m || m <= 0) return '0min';
    const h = Math.floor(m / 60);
    const rest = Math.round(m % 60);
    if (h === 0) return `${rest}min`;
    return rest > 0 ? `${h}h ${rest}min` : `${h}h`;
  }

  function formatDate(d: string): string {
    try {
      return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return '-';
    }
  }

  function formatDateShort(d: string): string {
    try {
      return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    } catch {
      return '-';
    }
  }

  const visibleEntries = entries.filter((e) => {
    if (billableParam === 'billable') return e.is_billable;
    if (billableParam === 'non_billable') return !e.is_billable;
    return true;
  });

  const totalMin = visibleEntries.reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const billableMin = visibleEntries
    .filter((e) => e.is_billable)
    .reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const nonBillableMin = visibleEntries
    .filter((e) => !e.is_billable)
    .reduce((s, e) => s + (e.duration_minutes || 0), 0);

  const dates = visibleEntries.map((e) => new Date(e.started_at).getTime());
  const minDate = dates.length ? new Date(Math.min(...dates)) : null;
  const maxDate = dates.length ? new Date(Math.max(...dates)) : null;

  if (loading) {
    return (
      <div className="print-report-loading">
        <p>Gerando relatório...</p>
      </div>
    );
  }

  return (
    <div className="print-report">
      {/* Toolbar (só aparece on-screen, escondida na impressão) */}
      <div className="print-toolbar no-print">
        <button onClick={() => window.print()} className="btn-print">
          Imprimir / Salvar PDF
        </button>
        <button onClick={() => window.close()} className="btn-close">
          Fechar
        </button>
      </div>

      {/* HEADER */}
      <header className="report-header">
        <div className="brand">
          <Image src="/bahflow-logo.svg" alt="Bah!Flow" width={140} height={32} priority />
          <p className="brand-sub">{workspaceName}</p>
        </div>
        <div className="report-meta">
          <p className="meta-label">Emitido em</p>
          <p className="meta-value">
            {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </header>

      {/* TÍTULO */}
      <section className="report-title">
        <p className="eyebrow">Relatório de Atividades</p>
        <h1>Horas trabalhadas — últimos {period} dias</h1>
        {(projectName || sprintName) && (
          <p className="context">
            {projectName && <span>Projeto: <strong>{projectName}</strong></span>}
            {projectName && sprintName && <span className="dot">·</span>}
            {sprintName && <span>Sprint: <strong>{sprintName}</strong></span>}
          </p>
        )}
        {minDate && maxDate && (
          <p className="period">
            Período: {formatDate(minDate.toISOString())} — {formatDate(maxDate.toISOString())}
          </p>
        )}
      </section>

      {/* RESUMO */}
      <section className="summary">
        <div className="summary-card total">
          <p className="card-label">Total de horas</p>
          <p className="card-value">{formatMin(totalMin)}</p>
          <p className="card-sub">{visibleEntries.length} registro{visibleEntries.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="summary-card billable">
          <p className="card-label">Horas efetivas</p>
          <p className="card-value">{formatMin(billableMin)}</p>
          <p className="card-sub">Cobráveis</p>
        </div>
        <div className="summary-card non-billable">
          <p className="card-label">Não cobradas</p>
          <p className="card-value">{formatMin(nonBillableMin)}</p>
          <p className="card-sub">Internas</p>
        </div>
      </section>

      {/* POR MEMBRO */}
      {summary.length > 0 && (
        <section className="members">
          <h2>Por colaborador</h2>
          <table className="members-table">
            <thead>
              <tr>
                <th>Pessoa</th>
                <th className="num">Efetivas</th>
                <th className="num">Não cobradas</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.member_name}>
                  <td>{s.member_name}</td>
                  <td className="num">{formatMin(s.billable_minutes || 0)}</td>
                  <td className="num muted">{formatMin(s.non_billable_minutes || 0)}</td>
                  <td className="num strong">{formatMin(s.total_minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ATIVIDADES */}
      <section className="entries">
        <h2>Detalhamento das atividades</h2>
        {visibleEntries.length === 0 ? (
          <p className="empty">Nenhuma atividade registrada neste período.</p>
        ) : (
          <table className="entries-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Ticket</th>
                <th>Atividade</th>
                <th>Colaborador</th>
                <th className="num">Tempo</th>
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map((e) => (
                <tr key={e.id} className={e.is_billable ? '' : 'row-non-billable'}>
                  <td className="cell-date">{formatDateShort(e.started_at)}</td>
                  <td className="cell-ticket">{e.ticket_key || '—'}</td>
                  <td className="cell-title">{e.ticket_title || e.description || '—'}</td>
                  <td className="cell-member">{e.member_name}</td>
                  <td className="num cell-duration">{formatMin(e.duration_minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* FOOTER */}
      <footer className="report-footer">
        <p>
          Relatório gerado por <strong>Bah!Flow</strong> em{' '}
          {new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </footer>

      <style jsx>{`
        :global(html), :global(body) {
          background: #fff !important;
          color: #1a1a1a !important;
          margin: 0;
          padding: 0;
        }
        .print-report-loading {
          padding: 60px;
          font-family: var(--font-inter, system-ui), sans-serif;
          color: #666;
          text-align: center;
        }
        .print-report {
          max-width: 800px;
          margin: 0 auto;
          padding: 32px 40px 60px;
          font-family: var(--font-inter, system-ui), sans-serif;
          color: #1a1a1a;
          background: #fff;
          font-size: 13px;
          line-height: 1.5;
        }

        /* Toolbar — só on-screen */
        .print-toolbar {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px dashed #e5e5e5;
        }
        .btn-print, .btn-close {
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 500;
          border-radius: 6px;
          border: 1px solid #d4d4d4;
          background: #fff;
          color: #333;
          cursor: pointer;
          transition: background 0.15s;
        }
        .btn-print {
          background: #3b6cf5;
          color: #fff;
          border-color: #3b6cf5;
        }
        .btn-print:hover { background: #2954d4; }
        .btn-close:hover { background: #f5f5f5; }

        /* Header */
        .report-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 24px;
          border-bottom: 2px solid #1a1a1a;
        }
        .brand :global(img) {
          height: 32px;
          width: auto;
        }
        .brand-sub {
          margin: 6px 0 0;
          font-size: 12px;
          color: #666;
        }
        .report-meta {
          text-align: right;
        }
        .meta-label {
          margin: 0;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #888;
        }
        .meta-value {
          margin: 4px 0 0;
          font-size: 13px;
          color: #1a1a1a;
          font-weight: 500;
        }

        /* Título */
        .report-title {
          margin: 32px 0 28px;
        }
        .eyebrow {
          margin: 0;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #888;
          font-weight: 500;
        }
        h1 {
          margin: 8px 0 0;
          font-family: var(--font-serif, 'Newsreader', Georgia, serif);
          font-weight: 500;
          font-size: 28px;
          line-height: 1.15;
          color: #0a0a0a;
        }
        .context {
          margin: 12px 0 0;
          font-size: 13px;
          color: #555;
        }
        .context strong { color: #1a1a1a; font-weight: 500; }
        .dot { margin: 0 8px; color: #ccc; }
        .period {
          margin: 4px 0 0;
          font-size: 12px;
          color: #888;
        }

        /* Resumo */
        .summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin: 24px 0 36px;
        }
        .summary-card {
          padding: 16px 18px;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          background: #fafafa;
        }
        .summary-card.total {
          background: #1a1a1a;
          border-color: #1a1a1a;
          color: #fff;
        }
        .summary-card.total .card-label,
        .summary-card.total .card-sub { color: #aaa; }
        .summary-card.billable { border-left: 3px solid #059669; }
        .summary-card.non-billable { border-left: 3px solid #999; }
        .card-label {
          margin: 0;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #666;
          font-weight: 600;
        }
        .card-value {
          margin: 8px 0 4px;
          font-family: var(--font-serif, 'Newsreader', Georgia, serif);
          font-size: 26px;
          font-weight: 500;
          font-variant-numeric: tabular-nums;
        }
        .card-sub {
          margin: 0;
          font-size: 11px;
          color: #888;
        }

        /* Tabelas */
        section h2 {
          margin: 28px 0 12px;
          font-family: var(--font-serif, 'Newsreader', Georgia, serif);
          font-size: 18px;
          font-weight: 500;
          color: #0a0a0a;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        thead {
          display: table-header-group;
        }
        thead th {
          text-align: left;
          padding: 10px 12px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #666;
          font-weight: 600;
          background: #f5f5f5;
          border-bottom: 1px solid #d4d4d4;
        }
        tbody td {
          padding: 10px 12px;
          border-bottom: 1px solid #eee;
          vertical-align: top;
        }
        tbody tr {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        tbody tr:last-child td { border-bottom: none; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        .muted { color: #888; }
        .strong { font-weight: 600; color: #0a0a0a; }

        .members-table tbody tr:nth-child(even) td { background: #fafafa; }

        .entries-table .cell-date {
          color: #555;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
          width: 72px;
        }
        .entries-table .cell-ticket {
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 11px;
          color: #3b6cf5;
          white-space: nowrap;
          width: 70px;
        }
        .entries-table .cell-title { color: #1a1a1a; }
        .entries-table .cell-member {
          color: #555;
          white-space: nowrap;
          width: 120px;
        }
        .entries-table .cell-duration {
          white-space: nowrap;
          font-weight: 500;
          color: #0a0a0a;
          width: 70px;
        }
        .entries-table .row-non-billable {
          color: #888;
        }
        .entries-table .row-non-billable .cell-title,
        .entries-table .row-non-billable .cell-duration { color: #888; }
        .entries-table tbody tr:nth-child(even) td { background: #fafafa; }

        .empty {
          padding: 32px;
          text-align: center;
          color: #888;
          font-style: italic;
          font-size: 13px;
        }

        /* Footer */
        .report-footer {
          margin-top: 48px;
          padding-top: 20px;
          border-top: 1px solid #e5e5e5;
          font-size: 11px;
          color: #888;
          text-align: center;
        }
        .report-footer strong { color: #555; font-weight: 500; }

        /* PRINT */
        @media print {
          :global(.no-print) { display: none !important; }
          :global(html), :global(body) {
            background: #fff !important;
            margin: 0;
          }
          .print-report {
            padding: 0;
            max-width: none;
            font-size: 11.5px;
          }
          h1 { font-size: 24px; }
          section h2 { font-size: 15px; margin-top: 20px; }
          .card-value { font-size: 22px; }
          .summary { margin: 20px 0 28px; }
          .report-title { margin: 24px 0 20px; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }

        @page {
          margin: 16mm 14mm;
          size: A4;
        }
      `}</style>
    </div>
  );
}
