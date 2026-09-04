/**
 * Integration connectors
 *
 * Deliver workflow messages to external services.
 * The connectors are pure: credentials arrive as
 * arguments (the server route supplies them from
 * the environment), so every delivery can be
 * tested with a mocked fetch.
 */

export type ConnectorId = 'github' | 'slack' | 'email'

export interface GitHubCredentials {
  /** Personal access token with repo scope */
  token: string
  /** `owner/repository` to create issues in */
  repo: string
}

export interface SlackCredentials {
  /** Incoming webhook URL */
  webhookUrl: string
}

export interface EmailCredentials {
  /** API key for the mail provider */
  apiKey: string
  /** Mail provider HTTP endpoint */
  apiUrl: string
  /** Sender address */
  from: string
  /** Recipient address */
  to: string
}

export interface ConnectorCredentials {
  github?: GitHubCredentials
  slack?: SlackCredentials
  email?: EmailCredentials
}

export interface ConnectorMessage {
  title: string
  body: string
  /** Task the message is about, when there is one */
  taskName?: string
  taskUrl?: string
}

export interface ConnectorDelivery {
  success: boolean
  status?: number
  error?: string
}

export interface Connector {
  id: ConnectorId
  name: string
  description: string
  /** Whether the credentials are complete enough to deliver */
  isConfigured(credentials: ConnectorCredentials): boolean
  /** Deliver a message; never throws */
  deliver(
    credentials: ConnectorCredentials,
    message: ConnectorMessage
  ): Promise<ConnectorDelivery>
}

/** The message body with the task reference appended. */
function messageBody(message: ConnectorMessage): string {
  const parts = [message.body]
  if (message.taskName) {
    parts.push(`Task: ${message.taskName}`)
  }
  if (message.taskUrl) {
    parts.push(message.taskUrl)
  }
  return parts.join('\n\n')
}

/** Turn a fetch response into a delivery result. */
async function deliveryFrom(
  response: Response
): Promise<ConnectorDelivery> {
  if (response.ok) {
    return { success: true, status: response.status }
  }

  let error = `HTTP ${response.status}`
  try {
    const data = (await response.json()) as {
      message?: unknown
    }
    if (typeof data?.message === 'string') {
      error = data.message
    }
  } catch {
    // Non-JSON error body; keep the status text.
  }

  return { success: false, status: response.status, error }
}

/** GitHub: creates an issue in the configured repository. */
const github: Connector = {
  id: 'github',
  name: 'GitHub',
  description: 'Create GitHub issues from workflows',

  isConfigured(credentials) {
    return Boolean(
      credentials.github?.token && credentials.github?.repo
    )
  },

  async deliver(credentials, message) {
    const githubCredentials = credentials.github
    if (!githubCredentials?.token || !githubCredentials.repo) {
      return {
        success: false,
        error: 'GitHub connector is not configured',
      }
    }

    const [owner, repository] =
      githubCredentials.repo.split('/')
    if (!owner || !repository) {
      return {
        success: false,
        error: 'GitHub repo must be "owner/repository"',
      }
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repository}/issues`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubCredentials.token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'taskflow',
        },
        body: JSON.stringify({
          title: message.title,
          body: messageBody(message),
        }),
      }
    )

    return deliveryFrom(response)
  },
}

/** Slack: posts a message to an incoming webhook. */
const slack: Connector = {
  id: 'slack',
  name: 'Slack',
  description: 'Post messages to a Slack channel',

  isConfigured(credentials) {
    return Boolean(credentials.slack?.webhookUrl)
  },

  async deliver(credentials, message) {
    const webhookUrl = credentials.slack?.webhookUrl
    if (!webhookUrl) {
      return {
        success: false,
        error: 'Slack connector is not configured',
      }
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${message.title}\n\n${messageBody(message)}`,
      }),
    })

    return deliveryFrom(response)
  },
}

/**
 * Email: sends through an HTTP mail API
 * (Resend-style `POST {apiUrl}` with a bearer key).
 */
const email: Connector = {
  id: 'email',
  name: 'Email',
  description: 'Send email through a mail API',

  isConfigured(credentials) {
    const mail = credentials.email
    return Boolean(
      mail?.apiKey &&
        mail?.apiUrl &&
        mail?.from &&
        mail?.to
    )
  },

  async deliver(credentials, message) {
    const mail = credentials.email
    if (
      !mail?.apiKey ||
      !mail?.apiUrl ||
      !mail?.from ||
      !mail?.to
    ) {
      return {
        success: false,
        error: 'Email connector is not configured',
      }
    }

    const response = await fetch(mail.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mail.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: mail.from,
        to: mail.to,
        subject: message.title,
        text: messageBody(message),
      }),
    })

    return deliveryFrom(response)
  },
}

export const CONNECTORS: Connector[] = [
  github,
  slack,
  email,
]

export function getConnector(
  id: string
): Connector | undefined {
  return CONNECTORS.find(
    (connector) => connector.id === id
  )
}
