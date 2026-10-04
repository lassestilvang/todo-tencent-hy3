import { NextRequest, NextResponse } from 'next/server'
import { importAllData, type ExportData } from '@/lib/tasks'

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''

    let data: ExportData

    if (contentType.includes('application/json')) {
      data = await request.json()
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }
      const text = await file.text()
      data = JSON.parse(text)
    } else {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 })
    }

    // Validate data structure
    if (!data.version || !data.exportedAt || !Array.isArray(data.tasks)) {
      return NextResponse.json({ error: 'Invalid export file format' }, { status: 400 })
    }

    const options = {
      merge: true,
      onConflict: 'skip' as const,
    }

    const result = await importAllData(data, options)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Import failed', details: result.errors },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, imported: true })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: 'Failed to import data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}