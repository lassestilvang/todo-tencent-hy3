/**
 * Centralized request validation.
 *
 * Every route that accepts a JSON body can
 * share these helpers instead of hand-rolling
 * the same safeParse/400 dance, so invalid
 * input always produces the same response
 * shape:
 *
 *   { error: 'Invalid request data', details }
 *
 * A proxy/middleware cannot know each route's
 * schema, so the centralization point is this
 * module plus the uniform error response.
 */

import { NextResponse } from 'next/server'
import type { ZodSchema } from 'zod'

/** Thrown when a request body fails its schema. */
export class RequestValidationError extends Error {
  /** Zod-formatted field errors, or null when the body was not valid JSON */
  constructor(
    public readonly details: unknown
  ) {
    super('Invalid request data')
    this.name = 'RequestValidationError'
  }
}

/**
 * Parse a request's JSON body and validate it
 * against a schema. Throws
 * `RequestValidationError` on a malformed body
 * or a schema mismatch.
 */
export async function parseJsonBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<T> {
  let raw: unknown

  try {
    raw = await request.json()
  } catch {
    throw new RequestValidationError(null)
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    throw new RequestValidationError(
      result.error.format()
    )
  }

  return result.data
}

/**
 * The 400 response for a rejected request
 * body. Pass the error from `parseJsonBody`
 * straight through.
 */
export function validationErrorResponse(
  error: RequestValidationError
): NextResponse {
  return NextResponse.json(
    {
      error: 'Invalid request data',
      details: error.details,
    },
    { status: 400 }
  )
}
