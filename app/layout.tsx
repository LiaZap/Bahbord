import type { Metadata } from 'next';
import { ToastProvider } from '@/components/ui/Toast';
import SearchModal from '@/components/ui/SearchModal';
import KeyboardShortcuts from '@/components/ui/KeyboardShortcuts';
import './globals.css';

export const metadata: Metadata = {
  title: 'BahBoard',
  description: 'Sistema de gestão de projetos BahBoard'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <ToastProvider>
          {children}
          <SearchModal />
          <KeyboardShortcuts />
        </ToastProvider>
      </body>
    </html>
  );
}
