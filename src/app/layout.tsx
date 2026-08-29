import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/sidebar'
import { ThemeProvider } from '@/components/theme-provider'
import { SearchWrapper } from '@/components/search-wrapper'
import { SidebarLayout } from '@/components/sidebar-layout'
import { Toaster } from 'sonner'
import NextTopLoader from 'nextjs-toploader'
import { PWAManifest } from '@/components/pwa-manifest'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'TaskFlow - Daily Task Planner',
  description: 'A modern, professional daily task planner with analytics and focus mode',
  keywords: ['task planner', 'daily tasks', 'productivity', 'todo app', 'pomodoro', 'analytics'],
  authors: [{ name: 'TaskFlow Team' }],
  robots: { index: true, follow: true },
  icons: {
    icon: '/icons/icon-192x192.png',
    shortcut: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png',
  },
  openGraph: {
    title: 'TaskFlow - Daily Task Planner',
    description: 'A modern, professional daily task planner with analytics and focus mode',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TaskFlow - Daily Task Planner',
    description: 'A modern, professional daily task planner with analytics and focus mode',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TaskFlow',
  },
  other: {
    'theme-color': '#6366f1',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextTopLoader color="#6366f1" showSpinner={false} />
        <a
          href="#main"
          className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-4 py-2 focus:not-sr-only focus:absolute focus:top-4 focus:left-4"
        >
          Skip to main content
        </a>
        <ThemeProvider>
          <SearchWrapper>
            <SidebarLayout sidebar={<Sidebar />}>{children}</SidebarLayout>
          </SearchWrapper>
          <Toaster richColors position="top-right" />
          <PWAManifest />
        </ThemeProvider>
      </body>
    </html>
  )
}
