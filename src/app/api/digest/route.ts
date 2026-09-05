import { NextRequest, NextResponse } from 'next/server'
import {
  generateDailyDigest,
  generateWeeklyDigest,
  generateSummaryDigest,
  formatDigestAsHtml,
  formatDigestAsText,
  type DigestFrequency,
} from '@/lib/email-digest'
import { z } from 'zod'

const digestQuerySchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'summary']).optional().default('daily'),
  format: z.enum(['json', 'html', 'text']).optional().default('json'),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parseResult = digestQuerySchema.safeParse({
      frequency: searchParams.get('frequency') || undefined,
      format: searchParams.get('format') || undefined,
    })

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { frequency, format } = parseResult.data

    let digest
    switch (frequency) {
      case 'daily':
        digest = await generateDailyDigest()
        break
      case 'weekly':
        digest = await generateWeeklyDigest()
        break
      case 'summary':
        digest = await generateSummaryDigest()
        break
    }

    if (format === 'html') {
      const html = formatDigestAsHtml(digest)
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    if (format === 'text') {
      const text = formatDigestAsText(digest)
      return new NextResponse(text, {
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    return NextResponse.json(digest)
  } catch (error) {
    console.error('Failed to generate digest:', error)
    return NextResponse.json(
      { error: 'Failed to generate digest' },
      { status: 500 }
    )
  }
}
