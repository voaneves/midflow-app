import { createHashRouter, createMemoryRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { Toaster } from './components/ui'
import { useApp } from './lib/store'
import { Brand } from './pages/app/Brand'
import { ComingSoon } from './pages/app/ComingSoon'
import { Create } from './pages/app/create/Create'
import { Dashboard } from './pages/app/Dashboard'
import { Library } from './pages/app/Library'
import { Plans } from './pages/app/Plans'
import { Posts } from './pages/app/Posts'
import { Settings } from './pages/app/Settings'
import { Auth } from './pages/Auth'
import { Landing } from './pages/Landing'
import Gallery from './dev/Gallery'

function RequireAuth() {
  const user = useApp((s) => s.user)
  const loc = useLocation()
  if (!user) return <Navigate to="/entrar" replace state={{ from: loc.pathname }} />
  return <Outlet />
}

const routes = [
  { path: '/', element: <Landing /> },
  { path: '/entrar', element: <Auth mode="login" /> },
  { path: '/cadastro', element: <Auth mode="signup" /> },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/app',
        element: <AppLayout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'criar', element: <Navigate to="/app/criar/1" replace /> },
          { path: 'criar/:step', element: <Create /> },
          { path: 'posts', element: <Posts /> },
          { path: 'biblioteca', element: <Library /> },
          { path: 'marca', element: <Brand /> },
          { path: 'planos', element: <Plans /> },
          { path: 'config', element: <Settings /> },
          { path: 'calendario', element: <ComingSoon kind="calendario" /> },
          { path: 'relatorios', element: <ComingSoon kind="relatorios" /> },
        ],
      },
    ],
  },
  // dev-only: every style × every creative, for visual QA
  ...(import.meta.env.DEV ? [{ path: '/dev/galeria', element: <Gallery /> }] : []),
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
