export const dynamic = "force-dynamic";
import { Suspense } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import DocsLayout from '@/components/docs/DocsLayout';

export default function DocsPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#1a1c1e] text-[#c5c8c6]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-hidden">
          <Suspense fallback={
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          }>
            <DocsLayout />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
