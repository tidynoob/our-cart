import { createBrowserRouter } from 'react-router-dom'
import LandingPage from '@/pages/LandingPage'
import ListPage from '@/pages/ListPage'
import NotFoundPage from '@/pages/NotFoundPage'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AppShell from '@/components/AppShell'

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
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
