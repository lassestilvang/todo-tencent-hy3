/**
 * @jest-environment node
 *
 * The validation helpers build NextResponse
 * objects and parse request bodies.
 */
"use strict"

import { z } from 'zod'
import {
  parseJsonBody,
  RequestValidationError,
  validationErrorResponse,
} from '@/lib/validation'

const schema = z.object({
  name: z.string().min(1),
  priority: z.enum(['high', 'medium', 'low', 'none']).optional(),
})

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body:
      typeof body === 'string'
        ? body
        : JSON.stringify(body),
  })
}

describe('parseJsonBody', () => {
  it('returns the parsed data for a valid body', async () => {
    const data = await parseJsonBody(
      jsonRequest({ name: 'Write report', priority: 'high' }),
      schema
    )

    expect(data).toEqual({
      name: 'Write report',
      priority: 'high',
    })
  })

  it('throws with formatted issues on a schema mismatch', async () => {
    await expect(
      parseJsonBody(jsonRequest({ name: '' }), schema)
    ).rejects.toThrow(RequestValidationError)

    await expect(
      parseJsonBody(jsonRequest({ name: '' }), schema)
    ).rejects.toMatchObject({
      name: 'RequestValidationError',
      details: {
        name: {
          _errors: [
            'Too small: expected string to have >=1 characters',
          ],
        },
      },
    })
  })

  it('throws with null details for a malformed body', async () => {
    await expect(
      parseJsonBody(jsonRequest('not json'), schema)
    ).rejects.toMatchObject({
      details: null,
    })
  })

  it('throws with null details for an empty body', async () => {
    await expect(
      parseJsonBody(
        new Request('http://localhost/api/tasks', {
          method: 'POST',
        }),
        schema
      )
    ).rejects.toMatchObject({ details: null })
  })

  it('applies transforms before returning', async () => {
    const estimateSchema = z.object({
      estimate: z.coerce.number().int().positive(),
    })

    const data = await parseJsonBody(
      jsonRequest({ estimate: '30' }),
      estimateSchema
    )

    expect(data).toEqual({ estimate: 30 })
  })
})

describe('validationErrorResponse', () => {
  it('returns a 400 with the uniform error shape', () => {
    const error = new RequestValidationError({
      name: { _errors: ['Required'] },
    })

    const response = validationErrorResponse(error)

    expect(response.status).toBe(400)
    expect(response.headers.get('content-type')).toContain(
      'application/json'
    )
  })

  it('round-trips the details payload', async () => {
    const error = new RequestValidationError({
      name: { _errors: ['Too small'] },
    })

    const response = validationErrorResponse(error)
    const body = await response.json()

    expect(body).toEqual({
      error: 'Invalid request data',
      details: { name: { _errors: ['Too small'] } },
    })
  })

  it('reports a malformed body without details', async () => {
    const error = new RequestValidationError(null)

    const response = validationErrorResponse(error)
    const body = await response.json()

    expect(body).toEqual({
      error: 'Invalid request data',
      details: null,
    })
  })
})
