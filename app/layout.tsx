import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Portrait Exhibition',
  description: 'Transform your portrait into exhibition-ready AI artwork.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
