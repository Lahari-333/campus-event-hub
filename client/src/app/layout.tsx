import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Campus Event Hub — Discover Campus Events',
  description:
    'Discover, register, and manage campus events. Built for students, organizers, and administrators.',
  keywords: ['campus', 'events', 'hackathon', 'workshop', 'cultural', 'technical'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">
              {children}
            </main>
            <footer className="border-t border-slate-200 dark:border-slate-700 py-6 mt-auto">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  © {new Date().getFullYear()} Campus Event Hub. Built with ❤️ for the campus community.
                </p>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
