import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import TicketDetailView from '@/components/tickets/TicketDetailView';

interface TicketPageProps {
  params: { id: string };
}

export default function TicketPage({ params }: TicketPageProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#1a1c1e] text-[#c5c8c6]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <TicketDetailView ticketId={params.id} />
        </main>
      </div>
    </div>
  );
}
