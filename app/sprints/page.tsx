export const dynamic = "force-dynamic";
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ViewTabsWrapper from '@/components/layout/ViewTabsWrapper';
import SprintsView from '@/components/sprints/SprintsView';

export default function SprintsPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-surface text-primary">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <ViewTabsWrapper />
        <main className="flex-1 overflow-auto p-6">
          <SprintsView />
        </main>
      </div>
    </div>
  );
}
