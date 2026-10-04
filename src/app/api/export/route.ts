import { NextResponse } from 'next/server'
import { exportAllData, type ExportData } from '@/lib/tasks'

/**
 * Export all application data as JSON
 * @returns {Promise<NextResponse>} JSON file download
 */
export async function GET() {
  try {
    const data = await exportAllData()

    const json = JSON.stringify(data, null, 2)
    const filename = `taskflow-export-${new Date().toISOString().split('T')[0]}.json`

    return new NextResponse(json, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}