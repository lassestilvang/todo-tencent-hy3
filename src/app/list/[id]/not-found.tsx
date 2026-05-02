import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

export default function ListNotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 p-8">
      <AlertCircle className="text-muted-foreground h-12 w-12" />
      <h2 className="text-2xl font-bold">List Not Found</h2>
      <p className="text-muted-foreground">
        The list you&apos;re looking for doesn&apos;t exist or has been deleted.
      </p>
      <Button asChild>
        <Link href="/today">Go back to tasks</Link>
      </Button>
    </div>
  )
}
