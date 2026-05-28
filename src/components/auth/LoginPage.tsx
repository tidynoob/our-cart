import { Button } from '@/components/ui/button'

interface LoginPageProps {
  onSignIn: () => Promise<void>
  error?: string | null
}

export default function LoginPage({ onSignIn, error }: LoginPageProps) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-4">
      <h1 className="text-3xl font-bold">Our Cart</h1>
      <p className="text-muted-foreground text-center">
        Your shared grocery list
      </p>

      <section className="flex flex-col items-center gap-4 w-full max-w-sm">
        <Button onClick={onSignIn} size="lg">
          Sign in with Google
        </Button>
      </section>

      {error && (
        <p className="text-destructive text-sm text-center">{error}</p>
      )}
    </main>
  )
}
