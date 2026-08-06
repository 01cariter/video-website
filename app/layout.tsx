import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Manrope } from 'next/font/google';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });
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

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className={manrope.variable}>{children}</body>
    </html>
  );
}
