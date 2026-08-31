import { SettingsClient } from './settings-client'
import { Suspense } from 'react'

export const metadata = {
  title: 'Settings - TaskFlow',
  description: 'Manage your TaskFlow preferences',
}

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }>
        <SettingsClient />
      </Suspense>
    </div>
  )
}