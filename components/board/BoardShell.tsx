'use client';

import { useRef, useState, createContext, useContext } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
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

// Mapeamento das column keys para nomes de status
const statusKeyToName: Record<string, string> = {
  todo: 'NÃO INICIADO',
  waiting: 'AGUARDANDO RESPOSTA',
  progress: 'EM PROGRESSO',
  done: 'CONCLUÍDO',
};

export default function BoardShell({ services, statuses, ticketTypes, children }: BoardShellProps) {
  const modalRef = useRef<CreateTicketModalRef>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  function createInColumn(statusKey: string) {
    const statusName = statusKeyToName[statusKey];
    const matchingStatus = statuses.find((s) => s.name.toUpperCase() === statusName);
    modalRef.current?.open(matchingStatus?.id);
  }

  return (
    <BoardShellContext.Provider value={{ openTicket: setSelectedTicketId, createInColumn }}>
      <div className="flex h-screen overflow-hidden bg-surface text-primary">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header onCreateTicket={() => modalRef.current?.open()} />
          <main className="flex-1 overflow-auto p-5">
            <ApprovalGate>{children}</ApprovalGate>
          </main>
        </div>
        <CreateTicketModal ref={modalRef} services={services} statuses={statuses} ticketTypes={ticketTypes} />
        <TicketDetailModal ticketId={selectedTicketId} onClose={() => setSelectedTicketId(null)} />
        <RecentBoardTracker />
      </div>
    </BoardShellContext.Provider>
  );
}
