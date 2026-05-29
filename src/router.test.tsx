import { describe, it, expect, vi } from 'vitest'

// Mock all page/layout components so the test doesn't need real implementations
vi.mock('@/components/auth/ProtectedRoute', () => ({
  default: () => <div data-testid="protected-route">ProtectedRoute</div>,
}))
vi.mock('@/components/AppShell', () => ({
  default: () => <div data-testid="app-shell">AppShell</div>,
}))
vi.mock('@/pages/ListPage', () => ({
  default: () => <div data-testid="list-page">ListPage</div>,
}))
vi.mock('@/pages/LandingPage', () => ({
  default: () => <div data-testid="landing-page">LandingPage</div>,
}))
vi.mock('@/pages/NotFoundPage', () => ({
  default: () => <div data-testid="not-found">NotFound</div>,
}))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    realtime: { setAuth: vi.fn() },
  },
}))

import { router } from '@/router'

describe('router structure', () => {
  it('visiting /list/:code passes through ProtectedRoute and AppShell (D-01)', () => {
    // Assert the router was created and has routes
    expect(router.routes).toBeDefined()

    // Router structure (index 0 = '/', index 1 = ProtectedRoute wrapper, index 2 = '/*'):
    // router.routes[1] = ProtectedRoute pathless route
    // router.routes[1].children[0] = AppShell pathless layout route
    // router.routes[1].children[0].children[0] = /list/:code
    expect(router.routes.length).toBeGreaterThanOrEqual(2)

    const protectedRouteEntry = router.routes[1]
    expect(protectedRouteEntry.children).toBeDefined()
    expect(protectedRouteEntry.children!.length).toBeGreaterThanOrEqual(1)

    const appShellEntry = protectedRouteEntry.children![0]
    expect(appShellEntry.children).toBeDefined()
    expect(appShellEntry.children!.length).toBeGreaterThanOrEqual(1)

    const listRoute = appShellEntry.children![0]
    expect(listRoute.path).toBe('/list/:code')
  })
})
