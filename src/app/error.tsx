'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

export default function Error({
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
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="glass-effect bg-card/20 flex flex-col items-center justify-center rounded-3xl border p-12 shadow-2xl">
        <div className="from-destructive/80 to-destructive mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br shadow-lg">
          <AlertCircle className="h-12 w-12 text-white" />
        </div>
        <h2 className="from-foreground to-foreground/70 bg-gradient-to-r bg-clip-text text-4xl font-extrabold text-transparent">
          Something went wrong
        </h2>
        <p className="text-muted-foreground mt-4 mb-8 max-w-md text-lg">
          We encountered an unexpected error. Please try again or return to the
          dashboard.
        </p>
        <div className="flex gap-4">
          <Button
            onClick={reset}
            size="lg"
            className="shadow-primary/20 shadow-lg transition-all duration-200 hover:scale-105"
          >
            Try again
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => (window.location.href = '/')}
            className="transition-all duration-200 hover:scale-105"
          >
            Go Home
          </Button>
        </div>
      </div>
    </div>
  )
}
