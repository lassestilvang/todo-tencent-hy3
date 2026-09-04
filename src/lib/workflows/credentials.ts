/**
 * Server-only connector credentials.
 *
 * Secrets live in the environment and are only
 * ever read here (inside API routes), never in
 * the client-side workflow engine — the engine
 * asks the connectors API route to deliver on
 * its behalf.
 */
import type { ConnectorCredentials } from './connectors'

function required(
  ...names: string[]
): string | undefined {
  for (const name of names) {
    const value = process.env[name]
    if (value && value.trim() !== '') {
      return value
    }
  }
  return undefined
}

/**
 * Load connector credentials from the
 * environment. Unset connectors are simply
 * absent from the result; `isConfigured` on
 * each connector decides whether it can deliver.
 */
export function loadConnectorCredentials(): ConnectorCredentials {
  return {
    github: (() => {
      const token = required('GITHUB_TOKEN')
      const repo = required('GITHUB_REPO')
      return token && repo ? { token, repo } : undefined
    })(),
    slack: (() => {
      const webhookUrl = required('SLACK_WEBHOOK_URL')
      return webhookUrl ? { webhookUrl } : undefined
    })(),
    email: (() => {
      const apiKey = required('EMAIL_API_KEY')
      const apiUrl = required('EMAIL_API_URL')
      const from = required('EMAIL_FROM')
      const to = required('EMAIL_TO')
      return apiKey && apiUrl && from && to
        ? { apiKey, apiUrl, from, to }
        : undefined
    })(),
  }
}
