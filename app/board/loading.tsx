import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { ColumnSkeleton } from '@/components/ui/Skeleton';

export default function BoardLoading() {
  return (
    <div className="flex h-screen overflow-hidden bg-surface text-[#c5c8c6]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto bg-surface p-4">
          <div className="grid h-full grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <ColumnSkeleton />
            <ColumnSkeleton />
            <ColumnSkeleton />
            <ColumnSkeleton />
          </div>
        </main>
      </div>
    </div>
  );
}
