import { useQuery } from '@tanstack/react-query'

import { api } from '../../lib/api/client'
import { queryKeys } from '../../lib/query/client'
import { DataList, type Column } from '../shared/DataList'

// Field names match what the enterprise BFF actually returns. They did not: this asked for
// `maxFareMinor`, `requiresApprovalAbove` and `appliesTo`, none of which the service has ever
// sent, so both money columns rendered ₦NaN and the employee count read "undefined" — on the
// screen a travel manager uses to decide what their staff are allowed to spend.
interface Policy {
  readonly policyId: string
  readonly name: string
  readonly hardCapMinor: number | null
  readonly approvalThresholdMinor: number | null
  readonly currency: string
  readonly allowedClasses: readonly string[]
  readonly requiresCostCentre: boolean
  readonly requiresApprovalForSurge: boolean
  readonly isActive: boolean
  readonly activeEmployees: number
}

const COLUMNS: readonly Column<Policy>[] = [
  { key: 'name', header: 'Policy', render: (row) => row.name },
  {
    key: 'rules',
    header: 'Requires',
    // Replaces an "Applies to" column that had no field behind it. A policy applies to
    // whoever is assigned it, which the Employees column already says; these two flags are
    // real rules and were not shown anywhere.
    render: (row) => {
      const rules = [
        row.requiresCostCentre ? 'Cost centre' : null,
        row.requiresApprovalForSurge ? 'Approval on surge' : null,
      ].filter((rule): rule is string => rule !== null)

      return rules.length === 0 ? 'Nothing' : rules.join(' · ')
    },
    muted: true,
  },
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
    money: (row) => (row.hardCapMinor === null ? null : [row.hardCapMinor, row.currency]),
  },
  {
    key: 'approval',
    header: 'Approval above',
    money: (row) =>
      row.approvalThresholdMinor === null ? null : [row.approvalThresholdMinor, row.currency],
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
