export const dynamic = "force-dynamic";
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import InboxView from '@/components/personal/InboxView';
import ApprovalGate from '@/components/ui/ApprovalGate';
import { getAuthMember } from '@/lib/api-auth';

export default async function InboxPage() {
  const auth = await getAuthMember();

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-primary">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <ApprovalGate>
            <div className="mx-auto max-w-[900px] space-y-8">
              <div className="space-y-2">
                <p className="page-eyebrow">Workspace · {auth?.display_name || 'Você'}</p>
                <h1 className="page-title">
                  Caixa de entrada <span className="em">— menções e novidades.</span>
                </h1>
              </div>
              <InboxView />
            </div>
          </ApprovalGate>
        </main>
      </div>
    </div>
  );
}
