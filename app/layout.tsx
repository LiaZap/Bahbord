import type { Metadata } from 'next';
import { Inter, Newsreader } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { ThemeProvider } from '@/lib/theme-context';
import { ProjectProvider } from '@/lib/project-context';
import { ToastProvider } from '@/components/ui/Toast';
import { ConfirmProvider } from '@/components/ui/ConfirmModal';
// import SearchModal from '@/components/ui/SearchModal'; // fallback - substituído por CommandPalette
import CommandPalette from '@/components/ui/CommandPalette';
import KeyboardShortcuts from '@/components/ui/KeyboardShortcuts';
import AIChat from '@/components/ui/AIChat';
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
  title: 'Bah!Flow',
  description: 'Bah!Flow — gestão de projetos editorial',
  manifest: '/manifest.json',
  themeColor: '#3b6cf5',
  appleWebApp: {
    capable: true,
    title: 'Bah!Flow',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/bahflow-favicon-dark.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/bahflow-favicon-dark.svg' },
    ],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // i18n: locale + messages vêm do cookie `NEXT_LOCALE` (resolvido em
  // `i18n/request.ts`). Sem prefixo de URL — fallback pra `pt`.
  const locale = await getLocale();
  const messages = await getMessages();
  const htmlLang = locale === 'pt' ? 'pt-BR' : locale;

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
      <html lang={htmlLang} className={`${inter.variable} ${newsreader.variable}`} suppressHydrationWarning>
        <head>
          <link rel="manifest" href="/manifest.json" />
          <link rel="apple-touch-icon" href="/bahflow-favicon-dark.svg" />
          <meta name="theme-color" content="#3b6cf5" />
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
          <script dangerouslySetInnerHTML={{ __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').catch(function(err) {
                  console.warn('SW registration failed:', err);
                });
              });
            }
          `}} />
        </head>
        <body>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <ThemeProvider>
              <ProjectProvider>
                <ToastProvider>
                  <ConfirmProvider>
                    {children}
                    {/* <SearchModal /> */}
                    <CommandPalette />
                    <KeyboardShortcuts />
                    <AIChat />
                  </ConfirmProvider>
                </ToastProvider>
              </ProjectProvider>
            </ThemeProvider>
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
