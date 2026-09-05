import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { Card } from '../../components/ui/Card'
import { SearchInput } from '../../components/ui/Inputs'
import { ExportButton, ListToolbar, Pagination } from '../../components/ui/ListControls'
import { LoadError } from '../../components/ui/LoadError'
import { Money } from '../../components/ui/Money'
import { PageHeader } from '../../components/ui/PageHeader'
import { Table } from '../../components/ui/Table'
import { enterprise, type MonthSummary, type MyTrip, type MyTripListParams } from '../../lib/api/enterprise'
import { formatCount, formatWhen } from '../../lib/format'
import { useDebounced, usePagedList } from '../../lib/paging'
import { queryKeys } from '../../lib/query/client'
import { useMe } from '../session/useMe'

/**
 * My expenses: the employee's completed rides, summed by month.
 *
 * Nothing here is reimbursed — every ride is billed to the company — so this is the
 * statement an employee needs when finance asks what a line on the invoice was. The
 * monthly totals come from the server, grouped in the database, so they are right however
 * many rides sit behind them; the rides themselves page.
 */
export function MyExpensesPage() {
  const me = useMe()
  const [query, setQuery] = useState('')
  const q = useDebounced(query.trim())

  const months = useQuery({ queryKey: [...queryKeys.myTrips, 'expenses'], queryFn: enterprise.my.expenses })

  const params = useMemo<MyTripListParams>(() => ({ kind: 'Ride', q: q.length === 0 ? undefined : q }), [q])

  const rides = usePagedList<MyTrip, MyTripListParams>({
    key: [...queryKeys.myTrips, 'rides'],
    filters: params,
    fetchPage: (page) => enterprise.my.trips(page),
  })

  const now = new Date()
  const thisMonth = `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const current = months.data?.find((month) => month.month === thisMonth)
  const currency = current?.currency ?? me.data?.currency ?? 'NGN'

  return (
    <div className="space-y-5">
      <PageHeader
        title="My expenses"
        subtitle={me.data === undefined ? undefined : `Billed to ${me.data.company.name}${me.data.costCentreCode === null ? '' : ` under ${me.data.costCentreCode}`} — nothing to claim back`}
        actions={<ExportButton path={enterprise.my.tripsExportPath} query={{ ...params }} filename="orbit-my-expenses.csv" label="Export statement" />}
      />

      {months.isError ? (
        <LoadError error={months.error} what="your expenses" onRetry={() => { void months.refetch() }} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card title="This month">
              <Money minorUnits={current?.spendMinor ?? 0} currency={currency} className="text-[28px] font-semibold leading-[34px]" />
              <p className="mt-1 text-[12px] text-fg-tertiary">{formatCount(current?.rides ?? 0)} rides</p>
            </Card>
            <Card title="Needed approval">
              <p className="font-mono text-[28px] font-semibold leading-[34px] tabular">{formatCount(me.data?.policyBreachesThisMonth ?? 0)}</p>
              <p className="mt-1 text-[12px] text-fg-tertiary">rides this month outside policy</p>
            </Card>
            <Card title="Average fare">
              <Money
                minorUnits={current === undefined || current.rides === 0 ? 0 : Math.round(current.spendMinor / current.rides)}
                currency={currency}
                className="text-[28px] font-semibold leading-[34px]"
              />
              <p className="mt-1 text-[12px] text-fg-tertiary">per ride this month</p>
            </Card>
          </div>

          <Table<MonthSummary>
            columns={[
              { key: 'month', header: 'Month', render: (row) => <span className="text-[14px] font-medium">{monthLabel(row.month)}</span> },
              { key: 'rides', header: 'Rides', align: 'right', render: (row) => <span className="font-mono tabular">{formatCount(row.rides)}</span> },
              { key: 'spend', header: 'Spend', align: 'right', sorted: true, render: (row) => <Money minorUnits={row.spendMinor} currency={row.currency} /> },
            ]}
            rows={months.data}
            rowKey={(row) => row.month}
            isPending={months.isPending}
            emptyTitle="No completed rides yet"
            emptyHint="Your spend by month appears here after your first ride."
          />

          <ListToolbar>
            <SearchInput value={query} onChange={setQuery} placeholder="Search rides by route, reference or cost centre" className="w-[340px]" />
          </ListToolbar>

          {rides.query.isError ? (
            <LoadError error={rides.query.error} what="your rides" onRetry={() => { void rides.query.refetch() }} />
          ) : (
            <>
              <Table<MyTrip>
                columns={[
                  { key: 'ride', header: 'Ride', render: (row) => <span className="font-mono text-[12px]">{row.id}</span> },
                  { key: 'when', header: 'When', render: (row) => formatWhen(row.at) },
                  { key: 'route', header: 'Route', render: (row) => <>{row.pickupLabel} <span className="text-fg-tertiary">→</span> {row.dropoffLabel}</> },
                  { key: 'cc', header: 'Cost centre', render: (row) => row.costCentreCode ?? '—' },
                  { key: 'policy', header: 'Policy', render: (row) => row.policyReason ?? 'OK' },
                  { key: 'fare', header: 'Fare', align: 'right', render: (row) => <Money minorUnits={row.fareMinor} currency={row.currency} /> },
                ]}
                rows={rides.items}
                rowKey={(row) => row.id}
                isPending={rides.query.isPending}
                emptyTitle={q.length > 0 ? 'No rides match' : 'No rides to list'}
              />

              <Pagination list={rides} />
            </>
          )}
        </>
      )}
    </div>
  )
}

function monthLabel(month: string): string {
  const [year, index] = month.split('-').map(Number)

  if (year === undefined || index === undefined) {
    return month
  }

  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(year, index - 1, 1))
}
