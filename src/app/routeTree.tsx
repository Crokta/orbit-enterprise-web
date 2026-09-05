import { type QueryClient } from '@tanstack/react-query'
import { Outlet, createRootRouteWithContext, createRoute, redirect } from '@tanstack/react-router'

import { AppShell } from './AppShell'
import { isSessionValid, refreshAccessToken } from '../lib/auth/session'
import { ApprovalsPage } from '../features/approvals/ApprovalsPage'
import { BookRidePage } from '../features/booking/BookRidePage'
import { ChooseRidePage } from '../features/booking/ChooseRidePage'
import { CostCentresPage } from '../features/finance/CostCentresPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { EmployeesPage } from '../features/employees/EmployeesPage'
import { InvoicesPage } from '../features/finance/InvoicesPage'
import { MyExpensesPage } from '../features/expenses/MyExpensesPage'
import { MyPolicyPage } from '../features/policy/MyPolicyPage'
import { PoliciesPage } from '../features/policy/PoliciesPage'
import { AdminUsersPage } from '../features/settings/AdminUsersPage'
import { ApiKeysPage } from '../features/settings/ApiKeysPage'
import { SecurityPage } from '../features/settings/SecurityPage'
import { SettingsLayout } from '../features/settings/SettingsLayout'
import { SignInPage } from '../features/auth/SignInPage'
import { HomeRedirect } from '../features/session/HomeRedirect'
import { MyTripsPage } from '../features/trips/MyTripsPage'
import { OnboardingEntryPage } from '../features/onboarding/OnboardingEntryPage'
import { SetupWizardPage } from '../features/onboarding/SetupWizardPage'
import { RequestSentPage } from '../features/trips/RequestSentPage'
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
 * The onboarding link lands here, signed in or not.
 *
 * Outside the authenticated tree on purpose: the person opening it has no account yet.
 * The page creates one (or signs an existing one in), claims the company, and only then
 * hands over to the wizard behind authentication.
 */
const onboardingEntryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding/$token',
  component: OnboardingEntryPage,
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

    // TanStack signals a route redirect by throwing its own control-flow object, not
    // an Error. The lint rule is right in general and wrong about this one API.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({
      to: '/sign-in',
      search: { redirect: location.href },
    })
  },
  component: AppShell,
})

/** Optional `?q=` on list pages, so a link from one page can pre-fill another's search. */
const searchWithQuery = (search: Record<string, unknown>): { readonly q?: string } =>
  typeof search['q'] === 'string' ? { q: search['q'] } : {}

const page = (path: string, component: () => React.JSX.Element | null, withSearch = false) =>
  createRoute({
    getParentRoute: () => authenticatedRoute,
    path,
    component,
    ...(withSearch ? { validateSearch: searchWithQuery } : {}),
  })

const settingsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/settings',
  component: SettingsLayout,
})

const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/',
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({ to: '/settings/api-keys' })
  },
})

export const routeTree = rootRoute.addChildren([
  signInRoute,
  onboardingEntryRoute,
  authenticatedRoute.addChildren([
    // The index sends members to booking and admins to the dashboard.
    page('/', HomeRedirect),
    page('/setup', SetupWizardPage),
    page('/dashboard', DashboardPage),
    page('/employees', EmployeesPage, true),
    page('/trips', TripLogPage, true),
    page('/book', BookRidePage),
    page('/book/choose', ChooseRidePage),
    page('/my-trips', MyTripsPage),
    page('/my-trips/$approvalId', RequestSentPage),
    page('/my-expenses', MyExpensesPage),
    page('/policy', MyPolicyPage),
    page('/policies', PoliciesPage),
    page('/cost-centres', CostCentresPage),
    page('/invoices', InvoicesPage),
    page('/approvals', ApprovalsPage),
    settingsRoute.addChildren([
      settingsIndexRoute,
      createRoute({ getParentRoute: () => settingsRoute, path: '/api-keys', component: ApiKeysPage }),
      createRoute({ getParentRoute: () => settingsRoute, path: '/security', component: SecurityPage }),
      createRoute({ getParentRoute: () => settingsRoute, path: '/admins', component: AdminUsersPage }),
    ]),
  ]),
])
