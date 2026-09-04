import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import type { ReactElement } from 'react'
import { ErrorBoundary } from '@/components/error-boundary'

function Throwing({ message }: { message: string }) {
  throw new Error(message)
}

interface Rendered {
  container: HTMLElement
  rerender: (ui: ReactElement) => Promise<void>
  unmount: () => Promise<void>
}

/** Render into a detached container inside act(). */
async function render(ui: ReactElement): Promise<Rendered> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)

  await act(async () => {
    root.render(ui)
  })

  return {
    container,
    async rerender(next: ReactElement) {
      await act(async () => {
        root.render(next)
      })
    },
    async unmount() {
      await act(async () => {
        root.unmount()
      })
      container.remove()
    },
  }
}

describe('ErrorBoundary', () => {
  let consoleError: jest.SpiedFunction<'error', typeof console.error>

  beforeAll(() => {
    (global as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })

  afterAll(() => {
    delete (global as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
  })

  beforeEach(() => {
    // React logs every caught error; the tests
    // assert on the rendered fallback instead.
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  it('renders children when nothing throws', async () => {
    const { container, unmount } = await render(
      <ErrorBoundary>
        <div>healthy widget</div>
      </ErrorBoundary>
    )

    try {
      expect(container.textContent).toContain('healthy widget')
    } finally {
      await unmount()
    }
  })

  it('renders a named fallback when a child throws', async () => {
    const { container, unmount } = await render(
      <ErrorBoundary name="Trends">
        <Throwing message="dataset exploded" />
      </ErrorBoundary>
    )

    try {
      expect(container.textContent).toContain('Trends ran into a problem')
      expect(container.textContent).toContain('dataset exploded')
      expect(container.textContent).toContain('Try again')
    } finally {
      await unmount()
    }
  })

  it('renders a generic fallback without a name', async () => {
    const { container, unmount } = await render(
      <ErrorBoundary>
        <Throwing message="boom" />
      </ErrorBoundary>
    )

    try {
      expect(container.textContent).toContain('Something went wrong')
      expect(container.textContent).toContain('boom')
    } finally {
      await unmount()
    }
  })

  it('renders a custom fallback when provided', async () => {
    const { container, unmount } = await render(
      <ErrorBoundary
        fallback={(error, reset) => (
          <button onClick={reset}>retry: {error.message}</button>
        )}
      >
        <Throwing message="custom fail" />
      </ErrorBoundary>
    )

    try {
      expect(container.textContent).toContain('retry: custom fail')
    } finally {
      await unmount()
    }
  })

  it('derives the error state from a caught error', () => {
    const caught = new Error('derivation')
    const state = ErrorBoundary.getDerivedStateFromError(caught)

    expect(state).toEqual({ hasError: true, error: caught })
  })

  it('logs caught errors with the boundary name', () => {
    const boundary = new ErrorBoundary({ children: null, name: 'Stats' })
    const caught = new Error('crash')
    boundary.componentDidCatch(caught, { componentStack: '<div />' })

    expect(consoleError).toHaveBeenCalledWith(
      '[ErrorBoundary:Stats]',
      caught,
      { componentStack: '<div />' }
    )
  })

  it('recovers when reset after an error', async () => {
    // Throws only until the test flips this, so the
    // boundary can show real children after a reset.
    let shouldThrow = true
    function Flaky() {
      if (shouldThrow) throw new Error('flaky render')
      return <div>recovered</div>
    }

    const { container, unmount } = await render(
      <ErrorBoundary name="Widget">
        <Flaky />
      </ErrorBoundary>
    )

    try {
      expect(container.textContent).toContain('Widget ran into a problem')

      shouldThrow = false
      await act(async () => {
        container
          .querySelector('button')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      expect(container.textContent).toContain('recovered')
    } finally {
      await unmount()
    }
  })
})
