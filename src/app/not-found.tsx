import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FileQuestion } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="glass-effect bg-card/20 flex flex-col items-center justify-center rounded-3xl border p-12 shadow-2xl">
        <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg">
          <FileQuestion className="h-12 w-12 text-white" />
        </div>
        <h2 className="from-foreground to-foreground/70 bg-gradient-to-r bg-clip-text text-5xl font-extrabold text-transparent">
          404
        </h2>
        <p className="text-muted-foreground mt-4 mb-8 max-w-md text-lg">
          Oops! The page you&apos;re looking for doesn&apos;t exist or has been
          moved.
        </p>
        <Button
          asChild
          size="lg"
          className="shadow-primary/20 shadow-lg transition-all duration-200 hover:scale-105"
        >
          <Link href="/today">Return Home</Link>
        </Button>
      </div>
    </div>
  )
}
