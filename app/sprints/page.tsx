import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import SprintsView from '@/components/sprints/SprintsView';

export default function SprintsPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-surface text-[#c5c8c6]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <SprintsView />
        </main>
      </div>
    </div>
  );
}
