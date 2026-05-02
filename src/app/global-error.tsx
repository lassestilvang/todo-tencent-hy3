'use client'

import type { GlobalErrorProps } from 'next'
import NextError from 'next/error'

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html>
      <body>
        <NextError statusCode={500} title={error.message} />
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  )
}
