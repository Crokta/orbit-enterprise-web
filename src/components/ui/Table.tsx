import { type ReactNode } from 'react'

import { Menu, type MenuItem } from './Menu'
import { EmptyState } from './Card'
import { cn } from './cn'

/**
 * One column of a table.
 *
 * `align: 'right'` is for numbers and money — a column of fares is read by comparing
 * magnitudes, and that only works when the digits line up.
 */
export interface TableColumn<T> {
  readonly key: string
  readonly header: ReactNode
  readonly render: (row: T) => ReactNode
  readonly align?: 'left' | 'right' | 'center'
  readonly width?: string
  /** Draws the sort caret the design shows on the default sort column. */
  readonly sorted?: boolean
}

/**
 * The data table the console is mostly made of.
 *
 * One implementation of the header row, the hover state, the empty state and the row menu,
 * so fixing an accessibility detail fixes it on every page. Row actions arrive as a list
 * and become the "⋮" menu on the right, where the design puts it.
 */
export function Table<T>({
  columns,
  rows,
  rowKey,
  isPending,
  emptyTitle,
  emptyHint,
  rowActions,
  onRowClick,
  rowClassName,
  minWidth = 720,
}: {
  readonly columns: readonly TableColumn<T>[]
  readonly rows: readonly T[] | undefined
  readonly rowKey: (row: T) => string
  readonly isPending: boolean
  readonly emptyTitle: string
  readonly emptyHint?: string
  readonly rowActions?: (row: T) => readonly MenuItem[]
  readonly onRowClick?: (row: T) => void
  readonly rowClassName?: (row: T) => string | undefined
  readonly minWidth?: number
}) {
  const span = columns.length + (rowActions === undefined ? 0 : 1)

  return (
    <div className="overflow-x-auto rounded-xl border border-line-subtle bg-surface shadow-[var(--shadow-e1)]">
      <table className="w-full border-collapse text-[13px]" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-line-subtle bg-surface-sunken">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width === undefined ? undefined : { width: column.width }}
                className={cn(
                  'px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-tertiary',
                  column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left',
                )}
              >
                {column.sorted === true ? (
                  <span className="inline-flex items-center gap-1 text-fg-brand">
                    <svg viewBox="0 0 12 12" width="10" height="10" fill="currentColor" aria-hidden="true">
                      <path d="M2 4h8L6 8 2 4Z" />
                    </svg>
                    {column.header}
                  </span>
                ) : (
                  column.header
                )}
              </th>
            ))}
            {rowActions !== undefined && <th scope="col" className="w-12 px-2" aria-label="Actions" />}
          </tr>
        </thead>

        <tbody>
          {isPending ? (
            <tr>
              <td colSpan={span} className="px-4 py-12 text-center text-fg-tertiary">
                Loading…
              </td>
            </tr>
          ) : rows === undefined || rows.length === 0 ? (
            <tr>
              <td colSpan={span} className="p-0">
                <EmptyState title={emptyTitle}>{emptyHint}</EmptyState>
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick === undefined ? undefined : () => { onRowClick(row); }}
                className={cn(
                  'border-b border-line-subtle transition-colors last:border-0 hover:bg-hover',
                  onRowClick !== undefined && 'cursor-pointer',
                  rowClassName?.(row),
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 py-3 align-middle',
                      column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left',
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
                {rowActions !== undefined && (
                  <td className="px-2 py-2 text-right">
                    <Menu items={rowActions(row)} />
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

/** Two-line cell: a primary line and a muted secondary line beneath it. */
export function TwoLine({
  primary,
  secondary,
  mono = false,
}: {
  readonly primary: ReactNode
  readonly secondary?: ReactNode
  readonly mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[14px] font-medium leading-5 text-fg">{primary}</p>
      {secondary !== undefined && (
        <p className={cn('truncate text-[11px] leading-4 text-fg-tertiary', mono && 'font-mono')}>{secondary}</p>
      )}
    </div>
  )
}

/** "VI → Ikeja GRA". */
export function Route({ from, to }: { readonly from: string; readonly to: string }) {
  return (
    <span className="text-[14px] text-fg">
      {from} <span className="text-fg-tertiary">→</span> {to}
    </span>
  )
}
