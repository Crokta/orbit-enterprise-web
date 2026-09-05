import { useMemo, useState } from 'react'

import { Badge } from '../../components/ui/Badge'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { DefinitionRow } from '../../components/ui/Card'
import { Dialog } from '../../components/ui/Dialog'
import { SearchInput } from '../../components/ui/Inputs'
import { ExportButton, FilterSelect, ListToolbar, Pagination } from '../../components/ui/ListControls'
import { LoadError } from '../../components/ui/LoadError'
import { Money } from '../../components/ui/Money'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusPill, type Status } from '../../components/ui/StatusPill'
import { Table, TwoLine } from '../../components/ui/Table'
import { useToast } from '../../components/ui/Toast'
import { enterprise, type Invoice } from '../../lib/api/enterprise'
import { downloadCsv } from '../../lib/csv'
import { formatCount, formatDate, formatMoney, formatPeriod, formatShortDate } from '../../lib/format'
import { useDebounced, usePagedList } from '../../lib/paging'
import { queryKeys } from '../../lib/query/client'

/** Monthly consolidated billing. */
export function InvoicesPage() {
  const toast = useToast()
  const [paying, setPaying] = useState<Invoice | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | 'outstanding' | 'overdue' | 'paid'>('all')
  const q = useDebounced(query.trim())
  const params = useMemo(() => ({ q: q.length === 0 ? undefined : q, status: status === 'all' ? undefined : status }), [q, status])

  const invoices = usePagedList<Invoice, typeof params>({
    key: queryKeys.invoices.all,
    filters: params,
    fetchPage: (page) => enterprise.invoices.list(page),
  })

  const rows = invoices.items
  const outstanding = rows.filter((invoice) => invoice.status === 'Due' || invoice.status === 'Overdue')
  const outstandingMinor = outstanding.reduce((sum, invoice) => sum + invoice.totalMinor, 0)
  const currency = rows[0]?.currency ?? 'NGN'
  const overdue = rows.find((invoice) => invoice.status === 'Overdue')

  const now = new Date()
  const nextInvoice = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  /** Downloads one invoice as a statement: header, then every trip billed on it. */
  async function downloadStatement(invoice: Invoice) {
    setDownloading(invoice.invoiceId)

    try {
      const statement = await enterprise.invoices.statement(invoice.invoiceId)

      downloadCsv(
        `${invoice.invoiceId}.csv`,
        ['Invoice', 'Period', 'Ride', 'Completed', 'Employee', 'Cost centre', 'Pick-up', 'Destination', 'Policy', 'Fare', 'Currency'],
        [
          [invoice.invoiceId, formatPeriod(invoice.period, now), 'TOTAL', '', '', '', '', '', '', formatMoney(invoice.totalMinor, invoice.currency, { fraction: true }), invoice.currency],
          ...statement.trips.map((trip) => [
            invoice.invoiceId,
            formatPeriod(invoice.period, now),
            trip.rideId,
            trip.completedAt,
            trip.employeeName,
            trip.costCentre,
            trip.pickupLabel,
            trip.dropoffLabel,
            trip.policyBreach ?? 'OK',
            formatMoney(trip.fareMinor, trip.currency, { fraction: true }),
            trip.currency,
          ]),
        ],
      )
    } catch {
      toast.notify(`${invoice.invoiceId} could not be downloaded.`, 'danger')
    } finally {
      setDownloading(null)
    }
  }

  async function downloadAll() {
    for (const invoice of rows) {
      await downloadStatement(invoice)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Invoices"
        subtitle={
          invoices.query.data === undefined
            ? undefined
            : `${formatMoney(outstandingMinor, currency, { compact: true })} outstanding on this page · next invoice ${formatShortDate(nextInvoice)}`
        }
        actions={
          <>
            <ExportButton path={enterprise.invoices.exportPath} query={params} filename="orbit-invoices.csv" />
            <Button onClick={() => { void downloadAll() }} disabled={rows.length === 0} loading={downloading !== null}>
              Download statements
            </Button>
          </>
        }
      />

      <ListToolbar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search invoice number or period" className="w-[300px]" />
        <FilterSelect
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All invoices' },
            { value: 'outstanding', label: 'Outstanding' },
            { value: 'overdue', label: 'Overdue' },
            { value: 'paid', label: 'Paid' },
          ]}
        />
      </ListToolbar>

      {overdue !== undefined && (
        <Banner
          tone="danger"
          title={`${overdue.invoiceId} is ${String(daysOverdue(overdue, now))} days overdue`}
          action={<Button variant="danger" onClick={() => { setPaying(overdue); }}>Pay now</Button>}
        >
          {formatMoney(overdue.totalMinor, overdue.currency)} due {formatDate(overdue.dueAt)}. Travel is suspended for all employees after 14 days overdue.
        </Banner>
      )}

      {invoices.query.isError ? (
        <LoadError error={invoices.query.error} what="the invoices" onRetry={() => { void invoices.query.refetch() }} />
      ) : (
        <>
        <Table<Invoice>
          minWidth={900}
          columns={[
            {
              key: 'invoice',
              header: 'Invoice',
              render: (row) => <TwoLine primary={row.invoiceId} secondary={`Issued ${formatShortDate(row.issuedAt)}`} mono />,
            },
            { key: 'period', header: 'Period', render: (row) => formatPeriod(row.period, now) },
            { key: 'rides', header: 'Rides', align: 'right', render: (row) => <span className="font-mono tabular">{formatCount(row.tripCount)}</span> },
            { key: 'due', header: 'Due date', render: (row) => formatDate(row.dueAt) },
            { key: 'amount', header: 'Amount', align: 'right', sorted: true, render: (row) => <Money minorUnits={row.totalMinor} currency={row.currency} /> },
            { key: 'status', header: 'Status', render: (row) => <StatusPill status={toStatus(row.status)} /> },
          ]}
          rows={rows}
          rowKey={(row) => row.invoiceId}
          isPending={invoices.query.isPending}
          emptyTitle={q.length > 0 || status !== 'all' ? 'No invoices match' : 'No invoices have been issued yet'}
          emptyHint={q.length > 0 || status !== 'all' ? 'Try another search or filter.' : 'The first invoice is raised on the first of the month after your first ride.'}
          rowActions={(row) => [
            { label: 'Download statement', onSelect: () => { void downloadStatement(row) } },
            ...(row.status === 'Due' || row.status === 'Overdue' ? [{ label: 'Pay now', onSelect: () => { setPaying(row) } }] : []),
            { label: 'Copy invoice number', onSelect: () => { void navigator.clipboard.writeText(row.invoiceId).then(() => { toast.notify('Invoice number copied') }) } },
          ]}
        />
        <Pagination list={invoices} />
        </>
      )}

      <PayDialog invoice={paying} onClose={() => { setPaying(null); }} />
    </div>
  )
}

/**
 * How to settle an invoice.
 *
 * Orbit invoices are settled by bank transfer against the invoice number; there is no
 * card rail on the platform for corporate accounts. The dialog gives finance the exact
 * reference to quote, which is the thing that goes wrong when a transfer arrives unlabelled.
 */
function PayDialog({ invoice, onClose }: { readonly invoice: Invoice | null; readonly onClose: () => void }) {
  const toast = useToast()

  return (
    <Dialog open={invoice !== null} onClose={onClose} title="Pay by transfer" subtitle="Quote the invoice number as the payment reference so it reconciles automatically.">
      {invoice !== null && (
        <>
          <dl>
            <DefinitionRow label="Invoice" value={invoice.invoiceId} mono />
            <DefinitionRow label="Amount" value={<Money minorUnits={invoice.totalMinor} currency={invoice.currency} fraction />} />
            <DefinitionRow label="Due" value={formatDate(invoice.dueAt)} tone={invoice.status === 'Overdue' ? 'danger' : 'neutral'} />
            <DefinitionRow label="Payment reference" value={invoice.invoiceId} mono />
          </dl>
          <p className="text-[13px] text-fg-tertiary">
            Bank details are on the invoice PDF your finance contact receives by email. Payments are usually reflected within one business day.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button
              onClick={() => {
                void navigator.clipboard.writeText(invoice.invoiceId).then(() => { toast.notify('Payment reference copied') })
              }}
            >
              Copy payment reference
            </Button>
          </div>
        </>
      )}
    </Dialog>
  )
}

function toStatus(status: Invoice['status']): Status {
  switch (status) {
    case 'Paid':
      return 'paid'
    case 'Overdue':
      return 'overdue'
    case 'Voided':
      return 'voided'
    default:
      return 'due'
  }
}

function daysOverdue(invoice: Invoice, now: Date): number {
  return Math.max(1, Math.floor((now.getTime() - new Date(invoice.dueAt).getTime()) / 86_400_000))
}

export function InvoiceStatusBadge({ status }: { readonly status: Invoice['status'] }) {
  return <Badge tone={status === 'Paid' ? 'success' : status === 'Overdue' ? 'danger' : 'neutral'}>{status}</Badge>
}
