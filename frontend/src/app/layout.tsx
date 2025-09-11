import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from './Providers';

const inter = Inter({ subsets: ['latin'] });

export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const revalidate = 0

export const metadata: Metadata = {
  title: 'CRM Unifier',
  description: 'Unified customer correspondence platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}