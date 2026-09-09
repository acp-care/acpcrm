import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = { title: 'ACP CRM', description: 'Configurable CRM for Aged Care Physiotherapy' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-AU"><body>{children}</body></html>
}