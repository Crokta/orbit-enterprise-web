import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { LoadError } from '../../components/ui/LoadError'
import { Money } from '../../components/ui/Money'
import { PageHeader } from '../../components/ui/PageHeader'
import { Table } from '../../components/ui/Table'
import { enterprise, type MyTrip } from '../../lib/api/enterprise'
import { downloadCsv } from '../../lib/csv'
import { formatCount, formatMoney, formatWhen } from '../../lib/format'
import { queryKeys } from '../../lib/query/client'
import { useMe } from '../session/useMe'

interface MonthSummary {
  readonly key: string
  readonly label: string
  readonly rides: number
  readonly spendMinor: number
  readonly breaches: number
  readonly currency: string
}

/**
 * My expenses: the employee's completed rides, summed by month.
 *
 * Nothing here is reimbursed — every ride is billed to the company — so this is the
 * statement an employee needs when finance asks what a line on the invoice was.
 */
export function MyExpensesPage() {
  const me = useMe()
  const trips = useQuery({ queryKey: queryKeys.myTrips, queryFn: enterprise.my.trips })

  const rides = useMemo(() => (trips.data ?? []).filter((trip) => trip.kind === 'Ride'), [trips.data])

  const months = useMemo<readonly MonthSummary[]>(() => {
    const byMonth = new Map<string, MonthSummary>()

    for (const ride of rides) {
      const date = new Date(ride.at)
      const key = `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const current = byMonth.get(key)

      byMonth.set(key, {
        key,
        label: new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(date),
        rides: (current?.rides ?? 0) + 1,
        spendMinor: (current?.spendMinor ?? 0) + ride.fareMinor,
        breaches: (current?.breaches ?? 0) + (ride.policyReason === null ? 0 : 1),
        currency: ride.currency,
      })
    }

    return [...byMonth.values()].sort((a, b) => b.key.localeCompare(a.key))
  }, [rides])

  const current = months[0]

  function exportStatement() {
    downloadCsv(
      `orbit-my-expenses-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Ride', 'Completed', 'Pick-up', 'Destination', 'Cost centre', 'Policy', 'Fare', 'Currency'],
      rides.map((ride) => [ride.id, ride.at, ride.pickupLabel, ride.dropoffLabel, ride.costCentreCode, ride.policyReason ?? 'OK', formatMoney(ride.fareMinor, ride.currency, { fraction: true }), ride.currency]),
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="My expenses"
        subtitle={me.data === undefined ? undefined : `Billed to ${me.data.company.name}${me.data.costCentreCode === null ? '' : ` under ${me.data.costCentreCode}`} — nothing to claim back`}
        actions={<Button variant="secondary" onClick={exportStatement} disabled={rides.length === 0}>Export statement</Button>}
      />

      {trips.isError ? (
        <LoadError error={trips.error} what="your expenses" onRetry={() => { void trips.refetch() }} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card title="This month">
              <Money minorUnits={current?.spendMinor ?? 0} currency={current?.currency ?? me.data?.currency ?? 'NGN'} className="text-[28px] font-semibold leading-[34px]" />
              <p className="mt-1 text-[12px] text-fg-tertiary">{formatCount(current?.rides ?? 0)} rides</p>
            </Card>
            <Card title="Needed approval">
              <p className="font-mono text-[28px] font-semibold leading-[34px] tabular">{formatCount(current?.breaches ?? 0)}</p>
              <p className="mt-1 text-[12px] text-fg-tertiary">rides this month outside policy</p>
            </Card>
            <Card title="Average fare">
              <Money
                minorUnits={current === undefined || current.rides === 0 ? 0 : Math.round(current.spendMinor / current.rides)}
                currency={current?.currency ?? me.data?.currency ?? 'NGN'}
                className="text-[28px] font-semibold leading-[34px]"
              />
              <p className="mt-1 text-[12px] text-fg-tertiary">per ride this month</p>
            </Card>
          </div>

          <Table<MonthSummary>
            columns={[
              { key: 'month', header: 'Month', render: (row) => <span className="text-[14px] font-medium">{row.label}</span> },
              { key: 'rides', header: 'Rides', align: 'right', render: (row) => <span className="font-mono tabular">{formatCount(row.rides)}</span> },
              { key: 'breaches', header: 'Needed approval', align: 'right', render: (row) => <span className="font-mono tabular">{formatCount(row.breaches)}</span> },
              { key: 'spend', header: 'Spend', align: 'right', sorted: true, render: (row) => <Money minorUnits={row.spendMinor} currency={row.currency} /> },
            ]}
            rows={months}
            rowKey={(row) => row.key}
            isPending={trips.isPending}
            emptyTitle="No completed rides yet"
            emptyHint="Your spend by month appears here after your first ride."
          />

          <Table<MyTrip>
            columns={[
              { key: 'ride', header: 'Ride', render: (row) => <span className="font-mono text-[12px]">{row.id}</span> },
              { key: 'when', header: 'When', render: (row) => formatWhen(row.at) },
              { key: 'route', header: 'Route', render: (row) => <>{row.pickupLabel} <span className="text-fg-tertiary">→</span> {row.dropoffLabel}</> },
              { key: 'cc', header: 'Cost centre', render: (row) => row.costCentreCode ?? '—' },
              { key: 'fare', header: 'Fare', align: 'right', render: (row) => <Money minorUnits={row.fareMinor} currency={row.currency} /> },
            ]}
            rows={rides}
            rowKey={(row) => row.id}
            isPending={trips.isPending}
            emptyTitle="No rides to list"
          />
        </>
      )}
    </div>
  )
}
