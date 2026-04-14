import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { TableRowSkeleton } from '@/components/ui/Skeleton';

export default function ListLoading() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#1a1c1e] text-[#c5c8c6]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">
          <div className="sticky top-0 z-10 flex items-center border-b border-border/40 bg-sidebar px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span className="w-24 shrink-0">Key</span>
            <span className="flex-1">Título</span>
            <span className="w-32 shrink-0">Status</span>
            <span className="w-24 shrink-0">Prioridade</span>
            <span className="w-28 shrink-0">Serviço</span>
            <span className="w-28 shrink-0">Responsável</span>
            <span className="w-24 shrink-0 text-right">Data limite</span>
          </div>
          <div className="divide-y divide-border/20">
            {Array.from({ length: 10 }).map((_, i) => (
              <TableRowSkeleton key={i} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
