import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/sidebar'
import { ThemeProvider } from '@/components/theme-provider'
import { SearchWrapper } from '@/components/search-wrapper'
import { SidebarLayout } from '@/components/sidebar-layout'
import { Toaster } from 'sonner'
import NextTopLoader from 'nextjs-toploader'

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
  description: 'A modern, professional daily task planner',
  keywords: ['task planner', 'daily tasks', 'productivity', 'todo app'],
  authors: [{ name: 'TaskFlow Team' }],
  robots: { index: true, follow: true },
  icons: {
    icon: '/file.svg',
    apple: '/file.svg',
  },
  openGraph: {
    title: 'TaskFlow - Daily Task Planner',
    description: 'A modern, professional daily task planner',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary',
    title: 'TaskFlow - Daily Task Planner',
    description: 'A modern, professional daily task planner',
  },
  manifest: '/manifest.json',
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
          <SidebarLayout sidebar={<Sidebar />} search={<SearchWrapper />}>
            {children}
          </SidebarLayout>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
