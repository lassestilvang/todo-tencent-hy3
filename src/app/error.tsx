'use client'

import { useEffect } from 'react'
import type { ErrorProps } from 'next'

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
        <button
          onClick={reset}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
