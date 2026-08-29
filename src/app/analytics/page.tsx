import { AnalyticsDashboardClient } from './analytics-client'
import { Suspense } from 'react'

export const metadata = {
  title: 'Analytics - TaskFlow',
  description: 'Track your productivity trends and insights',
}

function AnalyticsPageContent() {
  return (
    <div className="container mx-auto py-8 px-4">
      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }>
        <AnalyticsDashboardClient />
      </Suspense>
    </div>
  )
}

export default function AnalyticsPage() {
  return <AnalyticsPageContent />
}