import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { ChipGroup } from '../../components/ui/Chip'
import { SearchInput } from '../../components/ui/Inputs'
import { ExportButton, ListToolbar, Pagination } from '../../components/ui/ListControls'
import { LoadError } from '../../components/ui/LoadError'
import { Money } from '../../components/ui/Money'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusPill, type Status } from '../../components/ui/StatusPill'
import { Table, TwoLine } from '../../components/ui/Table'
import { useToast } from '../../components/ui/Toast'
import { enterprise, type MyTrip, type MyTripListParams } from '../../lib/api/enterprise'
import { formatCount, formatMoney, formatWhen } from '../../lib/format'
import { useDebounced, usePagedList } from '../../lib/paging'
import { queryKeys } from '../../lib/query/client'
import { useMe } from '../session/useMe'

type Filter = 'all' | 'awaiting' | 'approved' | 'completed' | 'declined'

/** The employee's own trips: completed rides and every request they have made. */
export function MyTripsPage() {
  const me = useMe()
  const navigate = useNavigate()
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const q = useDebounced(query.trim())

  const params = useMemo<MyTripListParams>(
    () => ({
      q: q.length === 0 ? undefined : q,
      status: filter === 'all' ? undefined : filter === 'awaiting' ? 'Pending' : filter === 'approved' ? 'Approved' : filter === 'completed' ? 'Completed' : 'Declined',
    }),
    [q, filter],
  )

  const trips = usePagedList<MyTrip, MyTripListParams>({
    key: queryKeys.myTrips,
    filters: params,
    fetchPage: (page) => enterprise.my.trips(page),
    refetchInterval: 30_000,
  })

  const rows = trips.items

  return (
    <div className="space-y-5">
      <PageHeader
        title="My trips"
        subtitle={
          me.data === undefined
            ? undefined
            : `${formatCount(me.data.tripsThisMonth)} rides this month · ${formatMoney(me.data.spendThisMonthMinor, me.data.currency)}`
        }
        actions={
          <>
            <ExportButton path={enterprise.my.tripsExportPath} query={{ ...params }} filename="orbit-my-trips.csv" />
            <Button onClick={() => { void navigate({ to: '/book' }) }}>Book a ride</Button>
          </>
        }
      />

      <ListToolbar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search route, reference or cost centre" className="w-[300px]" />
        <ChipGroup<Filter>
          label="Filter trips"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'awaiting', label: 'Awaiting approval' },
            { value: 'approved', label: 'Approved' },
            { value: 'completed', label: 'Completed' },
            { value: 'declined', label: 'Declined' },
          ]}
        />
      </ListToolbar>

      {trips.query.isError ? (
        <LoadError error={trips.query.error} what="your trips" onRetry={() => { void trips.query.refetch() }} />
      ) : (
        <>
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
            isPending={trips.query.isPending}
            emptyTitle={filter === 'all' && q.length === 0 ? 'No trips yet' : 'Nothing here'}
            emptyHint={filter === 'all' && q.length === 0 ? 'Your completed rides and approval requests will appear here.' : 'Try another filter or search.'}
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

          <Pagination list={trips} />
        </>
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
