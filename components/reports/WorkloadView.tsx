'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import WorkloadHeatmap, {
  CellDetail,
  HeatmapSkeleton,
  LegendSwatch,
} from './workload/WorkloadHeatmap';
import WorkloadFilters, { WorkloadHeader } from './workload/WorkloadFilters';
import { defaultRange, formatTotalHours } from './workload/format';
import { useMe, useWorkloadData } from '@/lib/hooks/useWorkloadData';
import type {
  CellSelection,
  WorkloadProject,
} from './workload/types';

interface WorkloadViewProps {
  projects: WorkloadProject[];
}

export default function WorkloadView({ projects }: WorkloadViewProps): JSX.Element {
  const initial = useMemo(defaultRange, []);
  const [draftFrom, setDraftFrom] = useState<string>(initial.from);
  const [draftTo, setDraftTo] = useState<string>(initial.to);
  const [appliedFrom, setAppliedFrom] = useState<string>(initial.from);
  const [appliedTo, setAppliedTo] = useState<string>(initial.to);
  const [projectId, setProjectId] = useState<string>('');
  const [onlyMe, setOnlyMe] = useState<boolean>(false);
  const [selectedCell, setSelectedCell] = useState<CellSelection | null>(null);
  const { toast } = useToast();

  const me = useMe();
  const { data, loading, error, reload } = useWorkloadData({
    appliedFrom,
    appliedTo,
    projectId,
    onlyMe,
    meId: me?.id ?? null,
  });

  function applyDates() {
    if (!draftFrom || !draftTo) {
      toast('Informe as duas datas do período.', 'warning');
      return;
    }
    if (draftFrom > draftTo) {
      toast('A data inicial deve ser anterior à final.', 'warning');
      return;
    }
    setAppliedFrom(draftFrom);
    setAppliedTo(draftTo);
  }

  // ---- Derived: weekly totals (footer) ----
  const weeksTemplate = useMemo<Array<{ week_start: string; week_end: string }>>(() => {
    if (data?.members?.[0]?.weeks?.length) {
      return data.members[0].weeks.map((w) => ({ week_start: w.week_start, week_end: w.week_end }));
    }
    return [];
  }, [data]);

  const weeklyTotals = useMemo<number[]>(() => {
    if (!data || weeksTemplate.length === 0) return [];
    return weeksTemplate.map((_, idx) =>
      data.members.reduce((sum, m) => sum + (m.weeks[idx]?.estimate_minutes ?? 0), 0),
    );
  }, [data, weeksTemplate]);

  const grandTotal = useMemo<number>(
    () => (data ? data.members.reduce((s, m) => s + m.total_minutes, 0) : 0),
    [data],
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <WorkloadHeader loading={loading} onReload={reload} />

      <WorkloadFilters
        draftFrom={draftFrom}
        draftTo={draftTo}
        projectId={projectId}
        onlyMe={onlyMe}
        me={me}
        loading={loading}
        projects={projects}
        onChangeFrom={setDraftFrom}
        onChangeTo={setDraftTo}
        onChangeProject={setProjectId}
        onChangeOnlyMe={setOnlyMe}
        onApply={applyDates}
        onReload={reload}
      />

      {/* Heatmap or skeleton or empty */}
      {loading ? (
        <HeatmapSkeleton />
      ) : error ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-5">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 text-rose-500" />
            <div>
              <p className="text-sm font-medium text-rose-500">Não consegui carregar a carga</p>
              <p className="mt-1 text-xs text-secondary-muted">{error}</p>
            </div>
          </div>
        </div>
      ) : !data || data.members.length === 0 ? (
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]">
          <EmptyState
            illustration="no-activity"
            title="Sem dados de carga"
            description="Ninguém com tickets atribuídos no período e filtros selecionados. Ajuste o intervalo ou o projeto."
          />
        </div>
      ) : (
        <WorkloadHeatmap
          data={data}
          weeksTemplate={weeksTemplate}
          weeklyTotals={weeklyTotals}
          grandTotal={grandTotal}
          onCellClick={(member, week) => {
            if (week.tickets.length > 0) setSelectedCell({ member, week });
          }}
        />
      )}

      {/* Legend */}
      {!loading && data && data.members.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-secondary-muted">
          <span className="font-medium uppercase tracking-wider">Legenda:</span>
          <LegendSwatch className="bg-[var(--overlay-subtle)] border-[var(--card-border)]" label="Sem carga" />
          <LegendSwatch className="bg-emerald-500/15 border-emerald-500/25" label="Até 4h" />
          <LegendSwatch className="bg-emerald-500/35 border-emerald-500/40" label="4–20h" />
          <LegendSwatch className="bg-amber-500/30 border-amber-500/40" label="20–40h" />
          <LegendSwatch className="bg-rose-500/35 border-rose-500/45" label="Sobrecarga (>40h)" />
        </div>
      )}

      {/* Detail modal */}
      <Modal
        isOpen={selectedCell !== null}
        onClose={() => setSelectedCell(null)}
        title={
          selectedCell
            ? `${selectedCell.member.display_name} · ${formatTotalHours(selectedCell.week.estimate_minutes)}`
            : ''
        }
        maxWidth="max-w-2xl"
      >
        {selectedCell && <CellDetail selection={selectedCell} />}
      </Modal>
    </div>
  );
}
