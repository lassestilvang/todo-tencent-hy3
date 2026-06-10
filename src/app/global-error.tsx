'use client'

import './globals.css'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body className="dark:bg-background dark:text-foreground antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
          <div className="glass-effect bg-card/20 flex flex-col items-center justify-center rounded-3xl border p-12 shadow-2xl">
            <div className="from-destructive/80 to-destructive mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br shadow-lg">
              <span className="text-4xl text-white">!</span>
            </div>
            <h2 className="from-foreground to-foreground/70 bg-gradient-to-r bg-clip-text text-4xl font-extrabold text-transparent">
              Critical Application Error
            </h2>
            <p className="text-muted-foreground mt-4 mb-8 max-w-md text-lg">
              A fatal error occurred. We apologize for the inconvenience.
            </p>
            <div className="flex gap-4">
              <button
                onClick={reset}
                className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring inline-flex h-11 items-center justify-center rounded-md px-8 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => (window.location.href = '/')}
                className="border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-11 items-center justify-center rounded-md border px-8 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
