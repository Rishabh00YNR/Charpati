import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Cinzel, Cinzel_Decorative, Figtree } from 'next/font/google';
import './globals.css';

const display = Cinzel_Decorative({ subsets: ['latin'], weight: '700', variable: '--font-display', display: 'swap' });
const cardFont = Cinzel({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-card', display: 'swap' });
const uiFont = Figtree({ subsets: ['latin'], variable: '--font-ui', display: 'swap' });

export const metadata: Metadata = {
  title: 'Charpati · Coming soon',
  description: 'Four cards. Hidden. Lowest total wins. Charpati is a card game of memory, nerve and sneaky swaps for 3 to 5 friends. Coming soon.',
  openGraph: {
    title: 'Charpati',
    description: 'Four cards. Hidden. Lowest total wins. Coming soon.',
    type: 'website',
  },
};

export const viewport: Viewport = { themeColor: '#150E22', colorScheme: 'dark' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${cardFont.variable} ${uiFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
