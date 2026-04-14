'use client';

import { useRef } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import CreateTicketModal, { type CreateTicketModalRef } from './CreateTicketModal';

interface BoardShellProps {
  services: Array<{ id: string; name: string }>;
  statuses: Array<{ id: string; name: string }>;
  ticketTypes: Array<{ id: string; name: string }>;
  children: React.ReactNode;
}

export default function BoardShell({ services, statuses, ticketTypes, children }: BoardShellProps) {
  const modalRef = useRef<CreateTicketModalRef>(null);

  return (
    <div className="flex h-screen overflow-hidden bg-[#1a1c1e] text-[#c5c8c6]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onCreateTicket={() => modalRef.current?.open()} />
        <main className="flex-1 overflow-auto p-5">
          {children}
        </main>
      </div>
      <CreateTicketModal ref={modalRef} services={services} statuses={statuses} ticketTypes={ticketTypes} />
    </div>
  );
}
