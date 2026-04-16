import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { ThemeProvider } from '@/lib/theme-context';
import { ProjectProvider } from '@/lib/project-context';
import { ToastProvider } from '@/components/ui/Toast';
import { ConfirmProvider } from '@/components/ui/ConfirmModal';
import SearchModal from '@/components/ui/SearchModal';
import KeyboardShortcuts from '@/components/ui/KeyboardShortcuts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bahboard',
  description: 'Sistema de gestão de projetos',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: '#3b82f6',
          colorBackground: '#1a1c1e',
          colorInputBackground: '#232730',
          colorInputText: '#e2e8f0',
        },
      }}
    >
      <html lang="pt-BR" className="dark" suppressHydrationWarning>
        <body>
          <ThemeProvider>
            <ProjectProvider>
              <ToastProvider>
                <ConfirmProvider>
                  {children}
                  <SearchModal />
                  <KeyboardShortcuts />
                </ConfirmProvider>
              </ToastProvider>
            </ProjectProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
