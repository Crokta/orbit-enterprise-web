import { type QueryClient } from '@tanstack/react-query'
import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  redirect,
} from '@tanstack/react-router'

import { AppShell } from './AppShell'
import { isSessionValid, refreshAccessToken } from '../lib/auth/session'
import { ApprovalsPage } from '../features/approvals/ApprovalsPage'
import { BookRidePage } from '../features/booking/BookRidePage'
import { CostCentresPage } from '../features/finance/CostCentresPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { EmployeesPage } from '../features/employees/EmployeesPage'
import { InvoicesPage } from '../features/finance/InvoicesPage'
import { PoliciesPage } from '../features/policy/PoliciesPage'
import { SignInPage } from '../features/auth/SignInPage'
import { TripLogPage } from '../features/trips/TripLogPage'

export interface RouterContext {
  readonly queryClient: QueryClient
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
})

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-in',
  component: SignInPage,
})

/**
 * Everything behind authentication.
 *
 * The guard tries a refresh before redirecting. A user returning to an open tab after
 * lunch has an expired access token and a perfectly good refresh cookie; bouncing them
 * to a sign-in page they do not need is the single most irritating thing an internal
 * console can do.
 */
const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authenticated',
  beforeLoad: async ({ location }) => {
    if (isSessionValid()) {
      return
    }

    if (await refreshAccessToken()) {
      return
    }

    throw redirect({
      to: '/sign-in',
      // Where they were going, so they land there rather than on a dashboard after
      // signing in. A deep link that survives an auth redirect is what makes a link
      // pasted into a support chat worth pasting.
      search: { redirect: location.href },
    })
  },
  component: AppShell,
})

const routes = [
  { path: '/', component: DashboardPage },
  { path: '/employees', component: EmployeesPage },
  { path: '/trips', component: TripLogPage },
  { path: '/book', component: BookRidePage },
  { path: '/policies', component: PoliciesPage },
  { path: '/cost-centres', component: CostCentresPage },
  { path: '/invoices', component: InvoicesPage },
  { path: '/approvals', component: ApprovalsPage },
] as const

export const routeTree = rootRoute.addChildren([
  signInRoute,
  authenticatedRoute.addChildren(
    routes.map((route) =>
      createRoute({ getParentRoute: () => authenticatedRoute, path: route.path, component: route.component }),
    ),
  ),
])
