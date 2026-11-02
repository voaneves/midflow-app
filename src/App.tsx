import { createHashRouter, createMemoryRouter, Navigate, Outlet, RouterProvider, useLocation, type RouteObject } from 'react-router-dom'
import { Toaster } from './components/ui'
import { useApp } from './lib/store'
import { Landing } from './pages/Landing'

function RequireAuth() {
  const user = useApp((s) => s.user)
  const loc = useLocation()
  if (!user) return <Navigate to="/entrar" replace state={{ from: loc.pathname }} />
  return <Outlet />
}

/*
 * Route-level code splitting: only the landing page ships in the entry bundle.
 * React Router keeps the current screen on display while the next chunk loads (no blank flash).
 */
const routes: RouteObject[] = [
  { path: '/', element: <Landing /> },
  { path: '/entrar', lazy: () => import('./pages/Auth').then((m) => ({ element: <m.Auth mode="login" /> })) },
  { path: '/cadastro', lazy: () => import('./pages/Auth').then((m) => ({ element: <m.Auth mode="signup" /> })) },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/app',
        lazy: () => import('./components/AppLayout').then((m) => ({ Component: m.AppLayout })),
        children: [
          { index: true, lazy: () => import('./pages/app/Dashboard').then((m) => ({ Component: m.Dashboard })) },
          { path: 'criar', element: <Navigate to="/app/criar/1" replace /> },
          { path: 'criar/:step', lazy: () => import('./pages/app/create/Create').then((m) => ({ Component: m.Create })) },
          { path: 'posts', lazy: () => import('./pages/app/Posts').then((m) => ({ Component: m.Posts })) },
          { path: 'biblioteca', lazy: () => import('./pages/app/Library').then((m) => ({ Component: m.Library })) },
          { path: 'marca', lazy: () => import('./pages/app/Brand').then((m) => ({ Component: m.Brand })) },
          { path: 'planos', lazy: () => import('./pages/app/Plans').then((m) => ({ Component: m.Plans })) },
          { path: 'config', lazy: () => import('./pages/app/Settings').then((m) => ({ Component: m.Settings })) },
          { path: 'calendario', lazy: () => import('./pages/app/CalendarPage').then((m) => ({ Component: m.CalendarPage })) },
          { path: 'relatorios', lazy: () => import('./pages/app/ReportsPage').then((m) => ({ Component: m.ReportsPage })) },
        ],
      },
    ],
  },
  // dev-only: every style × every creative, for visual QA
  ...(import.meta.env.DEV ? [{ path: '/dev/galeria', lazy: () => import('./dev/Gallery').then((m) => ({ Component: m.default })) }] : []),
  { path: '*', element: <Navigate to="/" replace /> },
]

// The single-file build runs inside a sandboxed frame where URL changes may be blocked → in-memory routing.
const router = import.meta.env.MODE === 'single' ? createMemoryRouter(routes) : createHashRouter(routes)

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  )
}
