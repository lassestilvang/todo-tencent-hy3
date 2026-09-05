import type { Metadata } from 'next'
import { Suspense } from 'react'
import { DigestView } from '@/components/digest-view'
import { generateSummaryDigest } from '@/lib/email-digest'

export const metadata: Metadata = {
  title: 'Digest - TaskFlow',
  description: 'Your daily productivity digest with task summaries and insights',
}

export default async function DigestPage() {
  const digest = await generateSummaryDigest()

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Productivity Digest</h1>
        <p className="text-sm text-muted-foreground">
          A snapshot of your task activity
        </p>
      </div>

      <Suspense fallback={<div>Loading digest...</div>}>
        <DigestView initialDigest={digest} />
      </Suspense>
    </div>
  )
}
