import type { Metadata } from 'next';
import { ThemeProvider } from '@/lib/theme-context';
import { ProjectProvider } from '@/lib/project-context';
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
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ProjectProvider>
            <ToastProvider>
              {children}
              <SearchModal />
              <KeyboardShortcuts />
            </ToastProvider>
          </ProjectProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
