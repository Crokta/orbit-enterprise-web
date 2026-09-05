import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { ChipGroup } from '../../components/ui/Chip'
import { LoadError } from '../../components/ui/LoadError'
import { Money } from '../../components/ui/Money'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusPill, type Status } from '../../components/ui/StatusPill'
import { Table, TwoLine } from '../../components/ui/Table'
import { useToast } from '../../components/ui/Toast'
import { enterprise, type MyTrip } from '../../lib/api/enterprise'
import { downloadCsv } from '../../lib/csv'
import { formatCount, formatMoney, formatWhen } from '../../lib/format'
import { queryKeys } from '../../lib/query/client'
import { useMe } from '../session/useMe'

type Filter = 'all' | 'upcoming' | 'awaiting' | 'completed' | 'declined'

/** The employee's own trips: completed rides and every request they have made. */
export function MyTripsPage() {
  const me = useMe()
  const navigate = useNavigate()
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('all')

  const trips = useQuery({ queryKey: queryKeys.myTrips, queryFn: enterprise.my.trips, refetchInterval: 30_000 })

  const rows = useMemo(() => {
    const items = trips.data ?? []

    switch (filter) {
      case 'upcoming':
        return items.filter((trip) => trip.status === 'Pending' || trip.status === 'Approved')
      case 'awaiting':
        return items.filter((trip) => trip.status === 'Pending')
      case 'completed':
        return items.filter((trip) => trip.status === 'Completed')
      case 'declined':
        return items.filter((trip) => trip.status === 'Declined' || trip.status === 'Expired' || trip.status === 'Withdrawn')
      default:
        return items
    }
  }, [trips.data, filter])

  const awaiting = (trips.data ?? []).filter((trip) => trip.status === 'Pending').length

  function exportTrips() {
    downloadCsv(
      `orbit-my-trips-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Reference', 'Kind', 'When', 'Pick-up', 'Destination', 'Cost centre', 'Status', 'Fare', 'Currency', 'Policy'],
      rows.map((trip) => [
        trip.id, trip.kind, trip.at, trip.pickupLabel, trip.dropoffLabel, trip.costCentreCode, trip.status,
        formatMoney(trip.fareMinor, trip.currency, { fraction: true }), trip.currency, trip.policyReason,
      ]),
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="My trips"
        subtitle={
          me.data === undefined
            ? undefined
            : `${formatCount(me.data.tripsThisMonth)} rides this month · ${formatMoney(me.data.spendThisMonthMinor, me.data.currency)} · ${formatCount(awaiting)} awaiting approval`
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <ChipGroup<Filter>
          label="Filter trips"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'awaiting', label: 'Awaiting approval', count: awaiting },
            { value: 'completed', label: 'Completed' },
            { value: 'declined', label: 'Declined' },
          ]}
        />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportTrips} disabled={rows.length === 0}>Export</Button>
          <Button onClick={() => { void navigate({ to: '/book' }) }}>Book a ride</Button>
        </div>
      </div>

      {trips.isError ? (
        <LoadError error={trips.error} what="your trips" onRetry={() => { void trips.refetch() }} />
      ) : (
        <Table<MyTrip>
          columns={[
            {
              key: 'trip',
              header: 'Trip',
              render: (row) => (
                <TwoLine
                  primary={<>{row.pickupLabel} <span className="text-fg-tertiary">→</span> {row.dropoffLabel}</>}
                  secondary={row.id}
                  mono
                />
              ),
            },
            { key: 'when', header: 'When', render: (row) => formatWhen(row.at) },
            { key: 'cc', header: 'Cost centre', render: (row) => row.costCentreCode ?? <span className="text-fg-tertiary">—</span> },
            { key: 'fare', header: 'Fare', align: 'right', sorted: true, render: (row) => <Money minorUnits={row.fareMinor} currency={row.currency} /> },
            {
              key: 'status',
              header: 'Status',
              render: (row) => <StatusPill status={toStatus(row)} label={row.status === 'Declined' && row.decisionNote !== null ? `Declined — ${row.decisionNote}` : undefined} />,
            },
          ]}
          rows={rows}
          rowKey={(row) => row.id}
          isPending={trips.isPending}
          emptyTitle={filter === 'all' ? 'No trips yet' : 'Nothing here'}
          emptyHint={filter === 'all' ? 'Your completed rides and approval requests will appear here.' : 'Try another filter.'}
          rowClassName={(row) => (row.status === 'Pending' ? 'bg-warning-subtle/40' : undefined)}
          onRowClick={(row) => {
            if (row.kind === 'Request') {
              void navigate({ to: '/my-trips/$approvalId', params: { approvalId: row.id } })
            }
          }}
          rowActions={(row) => [
            ...(row.kind === 'Request'
              ? [{ label: 'View request', onSelect: () => { void navigate({ to: '/my-trips/$approvalId', params: { approvalId: row.id } }) } }]
              : []),
            { label: 'Copy reference', onSelect: () => { void navigator.clipboard.writeText(row.id).then(() => { toast.notify('Reference copied') }) } },
            { label: 'Book again', onSelect: () => { void navigate({ to: '/book' }) } },
          ]}
        />
      )}
    </div>
  )
}

function toStatus(trip: MyTrip): Status {
  switch (trip.status) {
    case 'Completed':
      return 'completed'
    case 'Pending':
      return 'awaiting'
    case 'Approved':
      return 'approved'
    case 'Declined':
      return 'declined'
    case 'Expired':
      return 'expired'
    case 'Withdrawn':
      return 'withdrawn'
  }
}
