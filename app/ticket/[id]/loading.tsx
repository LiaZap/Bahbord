import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { DetailSkeleton } from '@/components/ui/Skeleton';

export default function TicketLoading() {
  return (
    <div className="flex h-screen overflow-hidden bg-surface text-[#c5c8c6]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <DetailSkeleton />
        </main>
      </div>
    </div>
  );
}
