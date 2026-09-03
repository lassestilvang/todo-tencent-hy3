'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Widget name shown in the fallback, e.g. "Trends" */
  name?: string
  /** Custom fallback; receives the error and a reset callback */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Isolates a failing widget: render and lifecycle errors
 * in the children are caught and replaced with a fallback
 * instead of taking down the whole page.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const label = this.props.name ? `:${this.props.name}` : ''
    console.error(`[ErrorBoundary${label}]`, error, errorInfo)
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset)
      }

      return (
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <p className="font-medium">
              {this.props.name
                ? `${this.props.name} ran into a problem`
                : 'Something went wrong'}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {this.state.error.message}
            </p>
            <Button variant="outline" size="sm" onClick={this.reset}>
              <RotateCcw className="h-3 w-3" />
              Try again
            </Button>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}
