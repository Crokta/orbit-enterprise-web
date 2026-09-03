import { useQuery } from '@tanstack/react-query'

import { StatusPill } from '../../components/ui/StatusPill'
import { api } from '../../lib/api/client'
import { queryKeys } from '../../lib/query/client'
import { DataList, type Column } from '../shared/DataList'

interface Employee {
  readonly employeeId: string
  readonly name: string
  readonly email: string
  readonly costCentre: string
  readonly monthlySpendMinor: number
  readonly currency: string
  readonly status: 'approved' | 'pending' | 'offline'
}

const COLUMNS: readonly Column<Employee>[] = [
  { key: 'name', header: 'Name', render: (row) => row.name },
  { key: 'email', header: 'Work email', render: (row) => row.email, muted: true },
  { key: 'costCentre', header: 'Cost centre', render: (row) => row.costCentre },
  { key: 'status', header: 'Status', render: (row) => <StatusPill status={row.status} /> },
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
