export const dynamic = 'force-dynamic';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import InboxList from '@/components/inbox/InboxList';
import ApprovalGate from '@/components/ui/ApprovalGate';
import { requireApproved } from '@/lib/page-guards';

export default async function InboxPage() {
  const auth = await requireApproved();

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-primary">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <ApprovalGate>
            <div className="mx-auto max-w-[960px] space-y-6">
              <div className="space-y-2">
                <p className="page-eyebrow">
                  Workspace · {auth?.display_name || 'Você'}
                </p>
                <h1 className="page-title">
                  Triagem{' '}
                  <span className="em">
                    — aceite, duplique ou recuse com a IA.
                  </span>
                </h1>
                <p className="text-[13px] text-secondary-muted">
                  Itens vindos de Slack, e-mail, links públicos e integrações
                  esperam sua decisão antes de virar tickets.
                </p>
              </div>
              <InboxList />
            </div>
          </ApprovalGate>
        </main>
      </div>
    </div>
  );
}
