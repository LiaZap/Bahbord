export const dynamic = "force-dynamic";
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import SavedFiltersView from '@/components/filters/SavedFiltersView';

export default function FiltersPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-surface text-primary">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <SavedFiltersView />
        </main>
      </div>
    </div>
  );
}
