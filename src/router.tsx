import { createBrowserRouter } from 'react-router-dom'
import LandingPage from '@/pages/LandingPage'
import ListPage from '@/pages/ListPage'
import NotFoundPage from '@/pages/NotFoundPage'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AppShell from '@/components/AppShell'
import InvitePage from '@/pages/InvitePage'

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/list/:code', element: <ListPage /> },
        ],
      },
      // InvitePage outside AppShell — full-screen spinner, no sidebar during join flow (per D-03/Pitfall 6)
      { path: '/invite/:code', element: <InvitePage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
