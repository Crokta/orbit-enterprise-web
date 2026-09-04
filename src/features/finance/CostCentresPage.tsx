import { useQuery } from '@tanstack/react-query'

import { api } from '../../lib/api/client'
import { queryKeys } from '../../lib/query/client'
import { DataList, type Column } from '../shared/DataList'

interface CostCentre {
  readonly code: string
  readonly name: string
  readonly ownerEmployeeId: string
  readonly monthlyBudgetMinor: number | null
  readonly spendMinor: number
  readonly currency: string
  readonly isOverBudget: boolean
}

const COLUMNS: readonly Column<CostCentre>[] = [
  { key: 'code', header: 'Code', render: (row) => <span className="tabular">{row.code}</span> },
  { key: 'name', header: 'Name', render: (row) => row.name },
  { key: 'owner', header: 'Owner', render: (row) => row.ownerEmployeeId, muted: true },
  {
    key: 'budget',
    header: 'Budget',
    money: (row) => (row.monthlyBudgetMinor === null ? null : [row.monthlyBudgetMinor, row.currency]),
  },
  { key: 'spend', header: 'Spend (MTD)', money: (row) => [row.spendMinor, row.currency] },
  {
    key: 'status',
    header: 'Status',
    // The service already decides this; the screen was throwing the answer away and showing
    // an employee count it never received. Over budget is the only thing on this table
    // anybody acts on.
    render: (row) => (row.isOverBudget ? 'Over budget' : 'Within budget'),
    muted: true,
  },
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
