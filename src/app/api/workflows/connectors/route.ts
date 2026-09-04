import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getConnector,
  type ConnectorMessage,
} from '@/lib/workflows/connectors'
import { loadConnectorCredentials } from '@/lib/workflows/credentials'

const deliverSchema = z.object({
  /** Connector id: github, slack or email */
  connector: z.string().min(1),
  title: z.string().min(1).max(500),
  body: z.string().max(10_000),
  taskName: z.string().max(500).optional(),
  taskUrl: z.string().url().optional(),
})

/**
 * Deliver a workflow message through an
 * integration connector.
 *
 * The workflow engine runs in the browser and
 * has no access to secrets, so it calls this
 * route with the message; the route reads
 * credentials from the environment and performs
 * the delivery server-side.
 */
export async function POST(request: NextRequest) {
  let body: z.infer<typeof deliverSchema>

  try {
    body = deliverSchema.parse(await request.json())
  } catch {
    return NextResponse.json(
      {
        error:
          'connector, title and body are required',
      },
      { status: 400 }
    )
  }

  const connector = getConnector(body.connector)
  if (!connector) {
    return NextResponse.json(
      { error: `Unknown connector: ${body.connector}` },
      { status: 400 }
    )
  }

  const credentials = loadConnectorCredentials()
  if (!connector.isConfigured(credentials)) {
    return NextResponse.json(
      {
        success: false,
        error: `${connector.name} connector is not configured`,
      },
      { status: 400 }
    )
  }

  const message: ConnectorMessage = {
    title: body.title,
    body: body.body,
    taskName: body.taskName,
    taskUrl: body.taskUrl,
  }

  try {
    const delivery = await connector.deliver(
      credentials,
      message
    )

    if (!delivery.success) {
      return NextResponse.json(
        { success: false, error: delivery.error },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      status: delivery.status,
    })
  } catch (error) {
    console.error('Connector delivery error:', error)
    const messageText =
      error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      { success: false, error: messageText },
      { status: 502 }
    )
  }
}
