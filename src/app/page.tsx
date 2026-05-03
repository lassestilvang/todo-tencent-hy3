import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'TaskFlow - Daily Task Planner',
}

export default function Home() {
  redirect('/today')
}
