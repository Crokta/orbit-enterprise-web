import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ChipGroup } from '../../components/ui/Chip'
import { SearchInput } from '../../components/ui/Inputs'
import { LoadError } from '../../components/ui/LoadError'
import { Money } from '../../components/ui/Money'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusPill } from '../../components/ui/StatusPill'
import { Route, Table, TwoLine } from '../../components/ui/Table'
import { useToast } from '../../components/ui/Toast'
import { enterprise, type Trip } from '../../lib/api/enterprise'
import { downloadCsv } from '../../lib/csv'
import { formatCount, formatMoney, formatPeriod, formatShortDate, formatTime, humanise } from '../../lib/format'
import { queryKeys } from '../../lib/query/client'
import { useSearchParam } from '../../lib/router'
import { useMe } from '../session/useMe'

type Filter = 'all' | 'breaches' | 'pending' | 'cancelled'

/**
 * Every corporate trip, paged.
 *
 * Cursor pagination, not offset. A trip log is written to continuously; with `OFFSET`
 * a row inserted between page one and page two shifts everything down by one, and the
 * user sees a row twice while another disappears entirely.
 */
export function TripLogPage() {
  const me = useMe()
  const navigate = useNavigate()
  const toast = useToast()
  const initialQuery = useSearchParam('q')

  const [query, setQuery] = useState(initialQuery)
  const [filter, setFilter] = useState<Filter>('all')
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [history, setHistory] = useState<string[]>([])
  const [downloading, setDownloading] = useState(false)

  const page = useQuery({
    queryKey: queryKeys.rides.list({ cursor }),
    queryFn: () => enterprise.trips.page(cursor, 50),

    // Keeps the previous page on screen while the next one loads. Without it the table
    // collapses to empty on every page turn, and the layout jumps.
    placeholderData: keepPreviousData,
  })

  const approvals = useQuery({
    queryKey: queryKeys.approvals.queue(),
    queryFn: enterprise.approvals.queue,
    enabled: me.data?.isApprover === true,
  })

  const rows = useMemo(() => {
    const items = page.data?.items ?? []
    const needle = query.trim().toLowerCase()

    return items.filter((trip) => {
      if (filter === 'breaches' && trip.policyBreach === null) {
        return false
      }

      if (filter === 'pending' || filter === 'cancelled') {
        // Completed trips are neither; those filters point at the approval queue below.
        return false
      }

      if (needle.length === 0) {
        return true
      }

      return [trip.rideId, trip.employeeName, trip.employeeEmail, trip.pickupLabel, trip.dropoffLabel, trip.costCentre ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [page.data, query, filter])

  const breaches = (page.data?.items ?? []).filter((trip) => trip.policyBreach !== null).length
  const now = new Date()
  const period = formatPeriod(`${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, '0')}`, now)

  function exportRows(trips: readonly Trip[], filename: string) {
    downloadCsv(
      filename,
      ['Ride', 'Completed', 'Employee', 'Email', 'Pick-up', 'Destination', 'Cost centre', 'Policy', 'Fare', 'Currency'],
      trips.map((trip) => [
        trip.rideId,
        trip.completedAt,
        trip.employeeName,
        trip.employeeEmail,
        trip.pickupLabel,
        trip.dropoffLabel,
        trip.costCentre,
        trip.policyBreach === null ? 'OK' : humanise(trip.policyBreach),
        formatMoney(trip.fareMinor, trip.currency, { fraction: true }),
        trip.currency,
      ]),
    )
  }

  /** Walks every page and exports the whole log. */
  async function downloadReport() {
    setDownloading(true)

    try {
      const all: Trip[] = []
      let next: string | undefined = undefined

      // Capped at 40 pages — two thousand trips — so a runaway cursor cannot loop forever.
      for (let i = 0; i < 40; i += 1) {
        const result = await enterprise.trips.page(next, 50)
        all.push(...result.items)

        if (result.nextCursor === null) {
          break
        }

        next = result.nextCursor
      }

      exportRows(all, `orbit-trip-report-${now.toISOString().slice(0, 10)}.csv`)
      toast.notify(`Report ready · ${formatCount(all.length)} rides`)
    } catch {
      toast.notify('The report could not be built. Please try again.', 'danger')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Trip log"
        subtitle={
          page.data === undefined
            ? undefined
            : `${formatCount(page.data.items.length)}${page.data.nextCursor === null ? '' : '+'} rides · ${period} · ${formatCount(breaches)} policy breaches on this page`
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => { exportRows(rows, `orbit-trips-${now.toISOString().slice(0, 10)}.csv`) }} disabled={rows.length === 0}>
              Export
            </Button>
            <Button loading={downloading} onClick={() => { void downloadReport() }}>
              Download report
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-4">
        <SearchInput value={query} onChange={setQuery} placeholder="Search rider, route or ride ID" className="w-[320px]" />
        <ChipGroup<Filter>
          label="Filter trips"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All rides' },
            { value: 'breaches', label: 'Policy breaches', count: breaches },
            { value: 'pending', label: 'Pending approval', count: approvals.data?.length },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
      </div>

      {page.isError ? (
        <LoadError error={page.error} what="the trip log" onRetry={() => { void page.refetch() }} />
      ) : filter === 'pending' ? (
        <PendingApprovals rows={approvals.data ?? []} isPending={approvals.isPending && me.data?.isApprover === true} />
      ) : filter === 'cancelled' ? (
        <div className="rounded-xl border border-line-subtle bg-surface p-12 text-center text-[13px] text-fg-tertiary">
          Cancelled rides are not billed and are not recorded in the trip log.
        </div>
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
            isPending={page.isPending}
            emptyTitle={query.length > 0 ? 'No rides match that search' : 'No rides yet'}
            emptyHint={query.length > 0 ? 'Try a ride ID, an employee name or part of an address.' : 'Completed corporate trips appear here as they happen.'}
            rowActions={(row) => [
              { label: 'Copy ride ID', onSelect: () => { void navigator.clipboard.writeText(row.rideId).then(() => { toast.notify('Ride ID copied') }) } },
              { label: 'Export this ride', onSelect: () => { exportRows([row], `${row.rideId}.csv`) } },
              { label: 'See employee', onSelect: () => { void navigate({ to: '/employees', search: { q: row.employeeEmail } }) } },
            ]}
          />

          <div className="flex items-center justify-between text-[13px] text-fg-tertiary">
            <span>{history.length === 0 ? 'Newest first' : `Page ${String(history.length + 1)}`}</span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={history.length === 0}
                onClick={() => {
                  setCursor(history.at(-2))
                  setHistory((previous) => previous.slice(0, -1))
                }}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page.data?.nextCursor == null}
                onClick={() => {
                  const next = page.data?.nextCursor
                  if (next != null) {
                    setHistory((previous) => [...previous, next])
                    setCursor(next)
                  }
                }}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function PendingApprovals({
  rows,
  isPending,
}: {
  readonly rows: readonly { readonly approvalId: string; readonly employeeName: string; readonly employeeEmail: string; readonly pickupLabel: string; readonly dropoffLabel: string; readonly policyReason: string; readonly estimatedFareMinor: number; readonly currency: string }[]
  readonly isPending: boolean
}) {
  return (
    <Table
      columns={[
        { key: 'id', header: 'Request', render: (row) => <span className="font-mono text-[13px]">{row.approvalId}</span> },
        { key: 'employee', header: 'Employee', render: (row) => <TwoLine primary={row.employeeName} secondary={row.employeeEmail} mono /> },
        { key: 'route', header: 'Route', render: (row) => <Route from={row.pickupLabel} to={row.dropoffLabel} /> },
        { key: 'policy', header: 'Policy', render: (row) => <div><Badge tone="warning">Needs approval</Badge><p className="mt-1 text-[11px] text-fg-tertiary">{row.policyReason}</p></div> },
        { key: 'status', header: 'Status', render: () => <StatusPill status="awaiting" /> },
        { key: 'fare', header: 'Fare', align: 'right', render: (row) => <Money minorUnits={row.estimatedFareMinor} currency={row.currency} /> },
      ]}
      rows={rows}
      rowKey={(row) => row.approvalId}
      isPending={isPending}
      emptyTitle="Nothing is waiting for approval"
      emptyHint="Requests appear here while an approver decides."
    />
  )
}
