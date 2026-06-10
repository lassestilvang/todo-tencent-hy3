import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Home - TaskFlow',
}

export default function Home() {
  redirect('/today')
}
