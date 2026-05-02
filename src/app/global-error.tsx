'use client'

import NextError from 'next/error'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body>
        <NextError statusCode={500} title={error.message} />
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  )
}
