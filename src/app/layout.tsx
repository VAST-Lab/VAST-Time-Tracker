import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'TimeTracker Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}