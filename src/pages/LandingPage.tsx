import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import LoginPage from '@/components/auth/LoginPage'
import CreateListForm from '@/components/CreateListForm'
import JoinListForm from '@/components/JoinListForm'

export default function LandingPage() {
  const user = useAuthStore((state) => state.user)
  const isLoading = useAuthStore((state) => state.isLoading)
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle)
  const error = useAuthStore((state) => state.error)
  const navigate = useNavigate()

  // Return-to-URL: navigate to stored path after sign-in (D-04)
  useEffect(() => {
    if (user) {
      const returnTo = sessionStorage.getItem('returnTo')
      if (returnTo && returnTo !== '/') {
        sessionStorage.removeItem('returnTo')
        navigate(returnTo, { replace: true })
      }
    }
  }, [user, navigate])

  // Loading guard: never flash login or content before auth state resolves
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  // Unauthenticated: show login screen
  if (!user) {
    return <LoginPage onSignIn={signInWithGoogle} error={error} />
  }

  // Authenticated: show create/join list forms
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
