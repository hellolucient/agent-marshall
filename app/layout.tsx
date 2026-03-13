import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agent Marshall',
  description: 'Editorial intelligence for Marshall S Martineau',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-stone-950 text-stone-100">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
