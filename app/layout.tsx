import type { Metadata } from 'next';
import { Inter, Newsreader } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { ThemeProvider } from '@/lib/theme-context';
import { ProjectProvider } from '@/lib/project-context';
import { ToastProvider } from '@/components/ui/Toast';
import { ConfirmProvider } from '@/components/ui/ConfirmModal';
// import SearchModal from '@/components/ui/SearchModal'; // fallback - substituído por CommandPalette
import CommandPalette from '@/components/ui/CommandPalette';
import KeyboardShortcuts from '@/components/ui/KeyboardShortcuts';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
});

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
      <html lang="pt-BR" className={`${inter.variable} ${newsreader.variable}`} suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: `
            (function(){
              try {
                var t = localStorage.getItem('bahjira-theme') || 'dark';
                if (t === 'system') t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                if (t === 'dark') { document.documentElement.classList.add('dark'); document.documentElement.style.colorScheme = 'dark'; }
                else { document.documentElement.classList.remove('dark'); document.documentElement.style.colorScheme = 'light'; }
              } catch(e) { document.documentElement.classList.add('dark'); }
            })();
          `}} />
        </head>
        <body>
          <ThemeProvider>
            <ProjectProvider>
              <ToastProvider>
                <ConfirmProvider>
                  {children}
                  {/* <SearchModal /> */}
                  <CommandPalette />
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
