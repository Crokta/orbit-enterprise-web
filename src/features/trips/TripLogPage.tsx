import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMemo, useState } from 'react'

import { Money } from '../../components/ui/Money'
import { StatusPill, type Status } from '../../components/ui/StatusPill'
import { api } from '../../lib/api/client'
import { queryKeys } from '../../lib/query/client'

interface TripRow {
  readonly rideId: string
  readonly employeeId: string
  readonly costCentre: string
  readonly pickupLabel: string
  readonly dropoffLabel: string
  readonly fareMinor: number
  readonly currency: string
  readonly completedAt: string | null
  readonly policyBreach: string | null
}

interface Page<T> {
  readonly items: readonly T[]
  readonly nextCursor: string | null
}

/**
 * Every corporate trip, paged.
 *
 * Cursor pagination, not offset. A trip log is written to continuously; with `OFFSET`
 * a row inserted between page one and page two shifts everything down by one, and the
 * user sees a row twice while another disappears entirely.
 */
export function TripLogPage() {
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [history, setHistory] = useState<string[]>([])

  const { data, isPending } = useQuery({
    queryKey: queryKeys.rides.list({ cursor }),
    queryFn: () => api.get<Page<TripRow>>('/v1/enterprise/trips', { query: { cursor, limit: 50 } }),

    // Keeps the previous page on screen while the next one loads. Without it the table
    // collapses to empty on every page turn, and the layout jumps.
    placeholderData: keepPreviousData,
  })

  const columns = useMemo<ColumnDef<TripRow>[]>(
    () => [
      {
        accessorKey: 'rideId',
        header: 'Ride',
        cell: (info) => <span className="tabular text-[13px]">{info.getValue<string>()}</span>,
      },
      { accessorKey: 'employeeId', header: 'Employee' },
      { accessorKey: 'costCentre', header: 'Cost centre' },
      {
        id: 'route',
        header: 'Route',
        cell: ({ row }) => (
          <span className="text-[13px] text-fg-secondary">
            {row.original.pickupLabel} → {row.original.dropoffLabel}
          </span>
        ),
      },
      {
        accessorKey: 'fareMinor',
        header: () => <span className="block text-right">Fare</span>,
        cell: ({ row }) => (
          // Right-aligned, because a column of money is read by comparing magnitudes and
          // that only works when the decimal points line up.
          <span className="block text-right">
            <Money minorUnits={row.original.fareMinor} currency={row.original.currency} />
          </span>
        ),
      },
      {
        accessorKey: 'state',
        header: 'Status',
        cell: (info) => <StatusPill status={toStatus(info.getValue<string>())} />,
      },
      {
        accessorKey: 'policyBreach',
        header: 'Policy',
        cell: (info) => {
          const breach = info.getValue<string | null>()

          return breach === null ? (
            <span className="text-[13px] text-fg-tertiary">Within policy</span>
          ) : (
            <span className="text-[13px] text-fg-warning">{breach}</span>
          )
        },
      },
    ],
    [],
  )

  const table = useReactTable({
    data: data?.items as TripRow[] | undefined ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-4">
      <h1 className="text-[28px] font-semibold leading-[34px]">Trip log</h1>

      {/* The table scrolls inside its own container. Letting the page scroll sideways
          takes the sidebar off-screen with it. */}
      <div className="overflow-x-auto rounded-lg border border-line-subtle bg-surface">
        <table className="w-full min-w-[900px] border-collapse text-[13px]">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b border-line-subtle">
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-fg-tertiary"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {isPending ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-fg-tertiary">
                  Loading trips…
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-fg-tertiary">
                  No trips yet.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-line-subtle last:border-0 hover:bg-hover">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={history.length === 0}
          onClick={() => {
            setCursor(history.at(-2))
            setHistory((previous) => previous.slice(0, -1))
          }}
          className="rounded-md border border-line px-3 py-1.5 text-[13px] disabled:text-fg-disabled"
        >
          Previous
        </button>

        <button
          type="button"
          disabled={data?.nextCursor == null}
          onClick={() => {
            const next = data?.nextCursor
            if (next != null) {
              setHistory((previous) => [...previous, next])
              setCursor(next)
            }
          }}
          className="rounded-md border border-line px-3 py-1.5 text-[13px] disabled:text-fg-disabled"
        >
          Next
        </button>
      </div>
    </div>
  )
}

/** Maps a ride state onto the status ramp, defaulting to something neutral. */
function toStatus(state: string): Status {
  switch (state) {
    case 'InTrip':
      return 'in-trip'
    case 'Cancelled':
    case 'Expired':
      return 'cancelled'
    case 'Completed':
      return 'approved'
    default:
      // An unrecognised state is a newer backend talking to an older console. Showing
      // it as offline is better than crashing the table on an index that is not there.
      return 'offline'
  }
}
