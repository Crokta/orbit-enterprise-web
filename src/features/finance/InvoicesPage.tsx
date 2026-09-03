import { useQuery } from '@tanstack/react-query'

import { StatusPill, type Status } from '../../components/ui/StatusPill'
import { api } from '../../lib/api/client'
import { queryKeys } from '../../lib/query/client'
import { DataList, type Column } from '../shared/DataList'

interface Invoice {
  readonly invoiceId: string
  readonly period: string
  readonly issuedAt: string
  readonly dueAt: string
  readonly totalMinor: number
  readonly currency: string
  readonly rides: number
  readonly status: 'paid' | 'due' | 'overdue'
}

const COLUMNS: readonly Column<Invoice>[] = [
  { key: 'invoiceId', header: 'Invoice', render: (row) => <span className="tabular">{row.invoiceId}</span> },
  { key: 'period', header: 'Period', render: (row) => row.period },
  { key: 'rides', header: 'Rides', render: (row) => String(row.rides) },
  { key: 'due', header: 'Due', render: (row) => new Date(row.dueAt).toLocaleDateString('en-NG'), muted: true },
  { key: 'status', header: 'Status', render: (row) => <StatusPill status={toStatus(row.status)} /> },
  { key: 'total', header: 'Total', money: (row) => [row.totalMinor, row.currency] },
]

/** Monthly consolidated billing. */
export function InvoicesPage() {
  const query = useQuery({
    queryKey: queryKeys.invoices.list({}),
    queryFn: () => api.get<readonly Invoice[]>('/v1/enterprise/invoices'),
  })

  return (
    <DataList
      title="Invoices"
      columns={COLUMNS}
      rows={query.data}
      isPending={query.isPending}
      rowKey={(row) => row.invoiceId}
      emptyMessage="No invoices have been issued yet."
    />
  )
}

function toStatus(status: Invoice['status']): Status {
  // Overdue maps onto the arrears colour deliberately: it is the same idea as a rider
  // in arrears — service continued, money did not follow — and it should read the same.
  return status === 'paid' ? 'approved' : status === 'overdue' ? 'arrears' : 'pending'
}
