import '@fontsource-variable/instrument-sans/wght.css';
import '@fontsource-variable/instrument-sans/wght-italic.css';
import '@fontsource-variable/bricolage-grotesque/wght.css';
import '@fontsource-variable/space-grotesk/wght.css';
import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { TooltipProvider } from '@/app/components/ui/tooltip';
import RouteProgress from '@/app/components/shell/RouteProgress';
import { I18nProvider } from '@/app/components/i18n-provider';
import { getLocale, messagesFor } from '@/lib/i18n/server';

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Snackd | Short-form learning and play',
  description: 'A short-form learning/play video app. Next.js on Vercel with Supabase.',
};

// Apply the saved theme before paint to avoid a flash of the wrong theme.
const themeInit = `(function(){try{var s=localStorage.getItem('snackd-theme');var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;if(s==='dark'||(!s&&d))document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();`;

export default async function RootLayout({
  children,
  modal,
}: Readonly<{
  children: ReactNode;
  modal: ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <I18nProvider locale={locale} messages={messagesFor(locale)}>
          <TooltipProvider>
            <RouteProgress />
            {children}
            {modal}
          </TooltipProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
