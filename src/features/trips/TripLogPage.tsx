import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { Badge } from '../../components/ui/Badge'
import { ChipGroup } from '../../components/ui/Chip'
import { SearchInput } from '../../components/ui/Inputs'
import { DateRange, ExportButton, ListToolbar, Pagination, dayBoundary } from '../../components/ui/ListControls'
import { LoadError } from '../../components/ui/LoadError'
import { Money } from '../../components/ui/Money'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusPill } from '../../components/ui/StatusPill'
import { Route, Table, TwoLine } from '../../components/ui/Table'
import { useToast } from '../../components/ui/Toast'
import { enterprise, type Trip, type TripListParams } from '../../lib/api/enterprise'
import { formatCount, formatPeriod, formatShortDate, formatTime, humanise } from '../../lib/format'
import { useDebounced, usePagedList } from '../../lib/paging'
import { queryKeys } from '../../lib/query/client'
import { useSearchParam } from '../../lib/router'

type Filter = 'all' | 'breaches'

/**
 * Every corporate trip, paged.
 *
 * Cursor pagination, not offset. A trip log is written to continuously; with `OFFSET`
 * a row inserted between page one and page two shifts everything down by one, and the
 * user sees a row twice while another disappears entirely. Search and filters go up with
 * the request, so a search for a name finds that person's trips on every page, not just
 * the one loaded.
 */
export function TripLogPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const initialQuery = useSearchParam('q')

  const [query, setQuery] = useState(initialQuery)
  const [filter, setFilter] = useState<Filter>('all')
  const [costCentre, setCostCentre] = useState(useSearchParam('costCentre'))
  const [range, setRange] = useState({ from: '', to: '' })

  const q = useDebounced(query.trim())
  const costCentreQ = useDebounced(costCentre.trim())

  const params = useMemo<TripListParams>(
    () => ({
      q: q.length === 0 ? undefined : q,
      breaches: filter === 'breaches' ? true : undefined,
      costCentre: costCentreQ.length === 0 ? undefined : costCentreQ,
      from: dayBoundary(range.from, 'start'),
      to: dayBoundary(range.to, 'end'),
    }),
    [q, filter, costCentreQ, range],
  )

  const page = usePagedList<Trip, TripListParams>({
    key: queryKeys.rides.all,
    filters: params,
    fetchPage: (next) => enterprise.trips.page(next),
  })

  const rows = page.items
  const breaches = rows.filter((trip) => trip.policyBreach !== null).length
  const now = new Date()
  const period = formatPeriod(`${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, '0')}`, now)
  const filtered = q.length > 0 || filter !== 'all' || costCentreQ.length > 0 || range.from.length > 0 || range.to.length > 0

  return (
    <div className="space-y-5">
      <PageHeader
        title="Trip log"
        subtitle={
          page.query.data === undefined
            ? undefined
            : `${formatCount(rows.length)}${page.hasNext ? '+' : ''} rides · ${period} · ${formatCount(breaches)} policy breaches on this page`
        }
        actions={
          <ExportButton path={enterprise.trips.exportPath} query={{ ...params }} filename="orbit-trip-log.csv" label="Download report" variant="primary" />
        }
      />

      <ListToolbar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search employee, route or ride ID" className="w-[320px]" />
        <ChipGroup<Filter>
          label="Filter trips"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All rides' },
            { value: 'breaches', label: 'Policy breaches', count: breaches },
          ]}
        />
        <input
          type="search"
          value={costCentre}
          onChange={(event) => { setCostCentre(event.target.value); }}
          placeholder="Cost centre"
          aria-label="Filter by cost centre"
          className="h-10 w-[150px] rounded-md border border-line bg-surface px-3 font-mono text-[13px] uppercase placeholder:font-sans placeholder:normal-case placeholder:text-fg-tertiary focus:border-line-focus focus:outline-none"
        />
        <DateRange from={range.from} to={range.to} onChange={setRange} />
      </ListToolbar>

      {page.query.isError ? (
        <LoadError error={page.query.error} what="the trip log" onRetry={() => { void page.query.refetch() }} />
      ) : (
        <>
          <Table<Trip>
            minWidth={960}
            columns={[
              {
                key: 'ride',
                header: 'Ride',
                render: (row) => (
                  <TwoLine
                    primary={<span className="font-mono text-[13px]">{row.rideId}</span>}
                    secondary={`${formatShortDate(row.completedAt)} · ${formatTime(row.completedAt)}`}
                    mono
                  />
                ),
              },
              { key: 'employee', header: 'Employee', render: (row) => <TwoLine primary={row.employeeName} secondary={row.employeeEmail} mono /> },
              { key: 'route', header: 'Route', render: (row) => <Route from={row.pickupLabel} to={row.dropoffLabel} /> },
              { key: 'cc', header: 'Cost centre', render: (row) => row.costCentre ?? <span className="text-fg-tertiary">—</span> },
              {
                key: 'policy',
                header: 'Policy',
                render: (row) =>
                  row.policyBreach === null ? (
                    <Badge tone="success">OK</Badge>
                  ) : (
                    <div>
                      <Badge tone="danger">Breach</Badge>
                      <p className="mt-1 text-[11px] text-fg-tertiary">{humanise(row.policyBreach)}</p>
                    </div>
                  ),
              },
              { key: 'status', header: 'Status', render: () => <StatusPill status="completed" /> },
              {
                key: 'fare',
                header: 'Fare',
                align: 'right',
                sorted: true,
                render: (row) => <Money minorUnits={row.fareMinor} currency={row.currency} />,
              },
            ]}
            rows={rows}
            rowKey={(row) => row.rideId}
            isPending={page.query.isPending}
            emptyTitle={filtered ? 'No rides match that search' : 'No rides yet'}
            emptyHint={filtered ? 'Try a ride ID, an employee name or part of an address.' : 'Completed corporate trips appear here as they happen.'}
            rowActions={(row) => [
              { label: 'Copy ride ID', onSelect: () => { void navigator.clipboard.writeText(row.rideId).then(() => { toast.notify('Ride ID copied') }) } },
              { label: 'See employee', onSelect: () => { void navigate({ to: '/employees', search: { q: row.employeeEmail } }) } },
            ]}
          />

          <Pagination list={page} />
        </>
      )}
    </div>
  )
}
