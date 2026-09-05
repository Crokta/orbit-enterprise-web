import { Navigate } from '@tanstack/react-router'

import { isAdmin } from '../../lib/api/enterprise'
import { DashboardPage } from '../dashboard/DashboardPage'
import { useMe } from './useMe'

/**
 * The index route.
 *
 * Admins land on the travel overview; everyone else on booking, because the dashboard
 * would answer them with a 403 and a member has nothing to see there anyway.
 */
export function HomeRedirect() {
  const me = useMe()

  if (me.data === undefined) {
    return null
  }

  // A company still setting up has nothing to show on a dashboard; the wizard is the
  // home page until it goes live.
  if (me.data.company.status === 'onboarding' || me.data.company.status === 'draft') {
    return <Navigate to="/setup" replace />
  }

  return isAdmin(me.data.role) ? <DashboardPage /> : <Navigate to="/book" replace />
}
