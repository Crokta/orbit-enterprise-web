import { useQuery } from '@tanstack/react-query'

import { api } from '../../lib/api/client'
import { queryKeys } from '../../lib/query/client'
import { DataList, type Column } from '../shared/DataList'

interface CostCentre {
  readonly code: string
  readonly name: string
  readonly owner: string
  readonly budgetMinor: number | null
  readonly spendMinor: number
  readonly currency: string
  readonly employees: number
}

const COLUMNS: readonly Column<CostCentre>[] = [
  { key: 'code', header: 'Code', render: (row) => <span className="tabular">{row.code}</span> },
  { key: 'name', header: 'Name', render: (row) => row.name },
  { key: 'owner', header: 'Owner', render: (row) => row.owner, muted: true },
  { key: 'employees', header: 'Employees', render: (row) => String(row.employees) },
  { key: 'budget', header: 'Budget', money: (row) => (row.budgetMinor === null ? null : [row.budgetMinor, row.currency]) },
  { key: 'spend', header: 'Spend (MTD)', money: (row) => [row.spendMinor, row.currency] },
]

/** Where the money is attributed. */
export function CostCentresPage() {
  const query = useQuery({
    queryKey: queryKeys.costCentres.all,
    queryFn: () => api.get<readonly CostCentre[]>('/v1/enterprise/cost-centres'),
  })

  return (
    <DataList
      title="Cost centres"
      columns={COLUMNS}
      rows={query.data}
      isPending={query.isPending}
      rowKey={(row) => row.code}
      emptyMessage="No cost centres yet."
    />
  )
}
