import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Bengkel Interior Mobil — Sistem Administrasi', description: 'Administrasi digital bengkel interior mobil' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="id"><body>{children}</body></html>;
}
