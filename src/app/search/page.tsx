import { SearchResults } from "@/components/search-results"

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Search Tasks</h1>
      <form className="mb-6">
        <input
          type="text"
          name="q"
          placeholder="Search by name or description..."
          defaultValue={(await searchParams).q || ''}
          className="w-full px-4 py-2 border rounded-lg bg-background"
          autoFocus
        />
      </form>
      <SearchResults query={(await searchParams).q || ''} />
    </div>
  )
}
