import CreateListForm from '@/components/CreateListForm'
import JoinListForm from '@/components/JoinListForm'

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-4">
      <h1 className="text-3xl font-bold">Our Cart</h1>

      <section className="flex flex-col items-center gap-4 w-full max-w-sm">
        <h2 className="text-xl font-semibold">Create a list</h2>
        <CreateListForm />
      </section>

      <section className="flex flex-col items-center gap-4 w-full max-w-sm">
        <h2 className="text-xl font-semibold">Join a list</h2>
        <JoinListForm />
      </section>
    </main>
  )
}
