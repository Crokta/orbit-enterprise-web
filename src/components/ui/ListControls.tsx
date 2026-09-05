import { useState, type ReactNode } from 'react'

import { Button } from './Button'
import { Icon } from './Icon'
import { Select } from './Inputs'
import { useToast } from './Toast'
import { cn } from './cn'
import { downloadFile } from '../../lib/download'
import { PAGE_SIZES, type PagedList, type PageSize } from '../../lib/paging'

/**
 * Previous / next and the page size, for a cursor-paged table.
 *
 * No "page 3 of 12": a keyset list has no cheap total, and a count that is out of date
 * the moment a row is inserted is a number nobody should trust. What it does say is where
 * you are and whether there is more.
 */
export function Pagination<T>({ list, className }: { readonly list: PagedList<T>; readonly className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 text-[13px] text-fg-tertiary', className)}>
      <div className="flex items-center gap-2">
        <span>{list.pageNumber === 1 ? 'Newest first' : `Page ${String(list.pageNumber)}`}</span>
        <span aria-hidden="true">·</span>
        <label className="flex items-center gap-2">
          <span>Rows</span>
          <Select
            aria-label="Rows per page"
            value={list.limit}
            onChange={(event) => { list.setLimit(Number(event.target.value) as PageSize); }}
            className="h-8 w-[84px] text-[13px]"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </Select>
        </label>
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={!list.hasPrevious} onClick={list.previous}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={!list.hasNext} onClick={list.next}>
          Next
        </Button>
      </div>
    </div>
  )
}

/**
 * Streams the current view as CSV from the server.
 *
 * The same filters as the table go up with the request, so what comes down is exactly
 * what is on screen — every page of it, not the one that happened to be loaded.
 */
export function ExportButton({
  path,
  query,
  filename,
  label = 'Export CSV',
  disabled,
  variant = 'secondary',
}: {
  readonly path: string
  readonly query?: Record<string, string | number | boolean | undefined>
  readonly filename?: string
  readonly label?: string
  readonly disabled?: boolean
  readonly variant?: 'primary' | 'secondary' | 'ghost'
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)

    try {
      await downloadFile(path, query ?? {}, filename)
    } catch (error) {
      toast.notify(error instanceof Error && error.message.length > 0 ? error.message : 'The export could not be downloaded.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant={variant} loading={busy} disabled={disabled} onClick={() => { void run() }}>
      <Icon name="download" size={16} />
      {label}
    </Button>
  )
}

/** A labelled dropdown filter that sits beside a search box. */
export function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  readonly label: string
  readonly value: T
  readonly options: readonly { readonly value: T; readonly label: string }[]
  readonly onChange: (value: T) => void
  readonly className?: string
}) {
  return (
    <Select
      aria-label={label}
      value={value}
      onChange={(event) => { onChange(event.target.value as T); }}
      className={cn('h-10 w-auto min-w-[160px] text-[14px]', className)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </Select>
  )
}

/** A from/to pair. Values are ISO dates (yyyy-mm-dd) or empty. */
export function DateRange({
  from,
  to,
  onChange,
}: {
  readonly from: string
  readonly to: string
  readonly onChange: (range: { readonly from: string; readonly to: string }) => void
}) {
  const input =
    'h-10 rounded-md border border-line bg-surface px-3 text-[14px] text-fg transition-colors focus:border-line-focus focus:outline-none'

  return (
    <div className="flex items-center gap-2 text-[13px] text-fg-tertiary">
      <label className="flex items-center gap-1.5">
        <span>From</span>
        <input type="date" aria-label="From date" value={from} max={to || undefined} onChange={(event) => { onChange({ from: event.target.value, to }); }} className={input} />
      </label>
      <label className="flex items-center gap-1.5">
        <span>To</span>
        <input type="date" aria-label="To date" value={to} min={from || undefined} onChange={(event) => { onChange({ from, to: event.target.value }); }} className={input} />
      </label>
    </div>
  )
}

/** Turns a `yyyy-mm-dd` input value into the start or end of that day, as an ISO instant. */
export function dayBoundary(value: string, edge: 'start' | 'end'): string | undefined {
  if (value.length === 0) {
    return undefined
  }

  const date = new Date(`${value}T${edge === 'start' ? '00:00:00.000' : '23:59:59.999'}`)

  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

/** The row of controls above a table: search on the left, filters, then actions. */
export function ListToolbar({ children, actions }: { readonly children: ReactNode; readonly actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">{children}</div>
      {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
