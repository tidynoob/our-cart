import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export default function ProtectedRoute() {
  const user = useAuthStore((state) => state.user)
  const isLoading = useAuthStore((state) => state.isLoading)
  const location = useLocation()

  // isLoading guard: never flash the login page before auth state resolves
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (!user) {
    // Store intended path for return-to after sign-in (survives OAuth redirect)
    sessionStorage.setItem('returnTo', location.pathname + location.search)
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
