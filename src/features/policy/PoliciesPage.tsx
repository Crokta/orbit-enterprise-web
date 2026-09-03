import { useQuery } from '@tanstack/react-query'

import { api } from '../../lib/api/client'
import { queryKeys } from '../../lib/query/client'
import { DataList, type Column } from '../shared/DataList'

interface Policy {
  readonly policyId: string
  readonly name: string
  readonly appliesTo: string
  readonly maxFareMinor: number | null
  readonly currency: string
  readonly allowedClasses: readonly string[]
  readonly requiresApprovalAbove: number | null
  readonly activeEmployees: number
}

const COLUMNS: readonly Column<Policy>[] = [
  { key: 'name', header: 'Policy', render: (row) => row.name },
  { key: 'appliesTo', header: 'Applies to', render: (row) => row.appliesTo, muted: true },
  {
    key: 'classes',
    header: 'Vehicle classes',
    // An empty list means every class, matching the geofence service's convention:
    // "nothing configured" and "nothing permitted" must not be the same state, or a
    // new policy silently blocks every ride.
    render: (row) => (row.allowedClasses.length === 0 ? 'All' : row.allowedClasses.join(', ')),
    muted: true,
  },
  {
    key: 'cap',
    header: 'Fare cap',
    money: (row) => (row.maxFareMinor === null ? null : [row.maxFareMinor, row.currency]),
  },
  {
    key: 'approval',
    header: 'Approval above',
    money: (row) => (row.requiresApprovalAbove === null ? null : [row.requiresApprovalAbove, row.currency]),
  },
  { key: 'employees', header: 'Employees', render: (row) => String(row.activeEmployees) },
]

/** The rules that decide whether a booking goes straight through. */
export function PoliciesPage() {
  const query = useQuery({
    queryKey: queryKeys.policies.all,
    queryFn: () => api.get<readonly Policy[]>('/v1/enterprise/policies'),
  })

  return (
    <DataList
      title="Ride policies"
      columns={COLUMNS}
      rows={query.data}
      isPending={query.isPending}
      rowKey={(row) => row.policyId}
      emptyMessage="No policies yet. Without one, every trip is allowed."
    />
  )
}
