import { SearchResults } from '@/components/search-results'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const params = await searchParams
  const query = params.q || ''

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Search Tasks</h1>
      <form className="mb-6">
        <input
          type="text"
          name="q"
          placeholder="Search by name or description..."
          defaultValue={query}
          className="bg-background w-full rounded-lg border px-4 py-2"
          autoFocus
        />
      </form>
      <SearchResults query={query} />
    </div>
  )
}
