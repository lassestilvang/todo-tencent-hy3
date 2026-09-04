import type { Metadata } from 'next'
import Link from 'next/link'
import { Brain, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchResults } from '@/components/search-results'
import { SemanticSearchResults } from '@/components/semantic-search-results'
import { getTasks } from '@/lib/tasks'

export const metadata: Metadata = {
  title: 'Search Tasks - TaskFlow',
  description: 'Search and find tasks by name or description',
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mode?: string }>
}) {
  const params = await searchParams
  const query = params.q || ''
  const mode = params.mode === 'ai' ? 'ai' : 'exact'

  // AI mode ranks every task by semantic
  // similarity, so it needs the full list.
  const tasks =
    mode === 'ai' && query.length >= 2
      ? await getTasks({ view: 'all' })
      : []

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Search Tasks</h1>
      <form className="mb-4">
        <label htmlFor="search-input" className="sr-only">
          Search tasks
        </label>
        <input
          id="search-input"
          type="text"
          name="q"
          placeholder="Search by name or description..."
          defaultValue={query}
          className="bg-background w-full rounded-lg border px-4 py-2"
        />
        <button
          type="submit"
          className="bg-primary text-primary-foreground mt-2 rounded-lg px-4 py-2"
        >
          Search
        </button>
      </form>

      <div className="mb-6 flex gap-2" role="tablist" aria-label="Search mode">
        <Button
          asChild
          variant={mode === 'exact' ? 'default' : 'outline'}
          size="sm"
        >
          <Link
            href={{ pathname: '/search', query: { q: query, mode: 'exact' } }}
            role="tab"
            aria-selected={mode === 'exact'}
          >
            <Search className="mr-1.5 h-3.5 w-3.5" />
            Exact match
          </Link>
        </Button>
        <Button
          asChild
          variant={mode === 'ai' ? 'default' : 'outline'}
          size="sm"
        >
          <Link
            href={{ pathname: '/search', query: { q: query, mode: 'ai' } }}
            role="tab"
            aria-selected={mode === 'ai'}
          >
            <Brain className="mr-1.5 h-3.5 w-3.5" />
            AI match
          </Link>
        </Button>
      </div>

      {mode === 'ai' ? (
        <SemanticSearchResults tasks={tasks} query={query} />
      ) : (
        <SearchResults query={query} />
      )}
    </div>
  )
}
