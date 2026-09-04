import { useQuery } from '@tanstack/react-query'

import { StatusPill } from '../../components/ui/StatusPill'
import { api } from '../../lib/api/client'
import { queryKeys } from '../../lib/query/client'
import { DataList, type Column } from '../shared/DataList'

interface Employee {
  readonly employeeId: string
  readonly workEmail: string
  readonly isApprover: boolean
  readonly costCentre: string
  readonly monthlySpendMinor: number
  readonly currency: string
  // Exactly what the service sends. This said 'approved' | 'pending' | 'offline', which
  // no employee has ever been, so the pill silently rendered blank.
  readonly status: 'Invited' | 'Active' | 'Suspended'
}

// The work address is the identity here. There is no display name to show: this service
// stores the address an employee was invited on and never learns what they are called —
// asking identity for a name per row would be a lookup per line of the table.
/** The service's vocabulary, mapped to the pill's. */
const STATUS = {
  Invited: 'invited',
  Active: 'active',
  Suspended: 'suspended',
} as const

const COLUMNS: readonly Column<Employee>[] = [
  { key: 'email', header: 'Work email', render: (row) => row.workEmail },
  { key: 'costCentre', header: 'Cost centre', render: (row) => row.costCentre },
  {
    key: 'approver',
    header: 'Approver',
    // Real, and previously not shown anywhere. Who can approve is the first thing somebody
    // asks when a trip is stuck awaiting one.
    render: (row) => (row.isApprover ? 'Yes' : '—'),
    muted: true,
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusPill status={STATUS[row.status]} />,
  },
  { key: 'spend', header: 'Spend (MTD)', money: (row) => [row.monthlySpendMinor, row.currency] },
]

/** Who at the company can book, and what they are spending. */
export function EmployeesPage() {
  const query = useQuery({
    queryKey: queryKeys.employees.list({}),
    queryFn: () => api.get<readonly Employee[]>('/v1/enterprise/employees'),
  })

  return (
    <DataList
      title="Employees"
      columns={COLUMNS}
      rows={query.data}
      isPending={query.isPending}
      rowKey={(row) => row.employeeId}
      emptyMessage="No employees have been invited yet."
    />
  )
}
