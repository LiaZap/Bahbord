'use client';

import { useRef, useState, useEffect, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ViewTabs from '@/components/layout/ViewTabs';
import CreateTicketModal, { type CreateTicketModalRef } from './CreateTicketModal';
import TicketDetailModal from '@/components/tickets/TicketDetailModal';
import RecentBoardTracker from './RecentBoardTracker';
import ApprovalGate from '@/components/ui/ApprovalGate';

interface BoardShellProps {
  services: Array<{ id: string; name: string }>;
  statuses: Array<{ id: string; name: string }>;
  ticketTypes: Array<{ id: string; name: string }>;
  children: React.ReactNode;
}

interface BoardShellContextValue {
  openTicket: (id: string) => void;
  createInColumn: (statusKey: string) => void;
}

const BoardShellContext = createContext<BoardShellContextValue>({
  openTicket: () => {},
  createInColumn: () => {},
});

export function useBoardShell() {
  return useContext(BoardShellContext);
}


export default function BoardShell({ services, statuses, ticketTypes, children }: BoardShellProps) {
  const modalRef = useRef<CreateTicketModalRef>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(data => {
      const role = data?.member?.role;
      setIsAdmin(role === 'owner' || role === 'admin');
    }).catch(() => {});
  }, []);

  function createInColumn(statusId: string) {
    // statusId agora é o UUID real do status — passa direto pro modal
    modalRef.current?.open(statusId);
  }

  function handleCloseDetailModal(changed: boolean = true) {
    setSelectedTicketId(null);
    if (changed) {
      // Force a full server-side reload to reflect changes
      router.refresh();
    }
  }

  return (
    <BoardShellContext.Provider value={{ openTicket: setSelectedTicketId, createInColumn }}>
      <div className="flex h-screen overflow-hidden bg-surface text-primary">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header onCreateTicket={() => modalRef.current?.open()} />
          <ViewTabs isAdmin={isAdmin} />
          <main className="flex-1 overflow-auto p-5">
            <ApprovalGate>{children}</ApprovalGate>
          </main>
        </div>
        <CreateTicketModal ref={modalRef} services={services} statuses={statuses} ticketTypes={ticketTypes} />
        <TicketDetailModal ticketId={selectedTicketId} onClose={() => handleCloseDetailModal(true)} />
        <RecentBoardTracker />
      </div>
    </BoardShellContext.Provider>
  );
}
