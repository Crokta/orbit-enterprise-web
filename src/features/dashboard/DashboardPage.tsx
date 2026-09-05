import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'

import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Icon } from '../../components/ui/Icon'
import { LoadError } from '../../components/ui/LoadError'
import { Money } from '../../components/ui/Money'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusPill } from '../../components/ui/StatusPill'
import { Route, Table, TwoLine } from '../../components/ui/Table'
import { cn } from '../../components/ui/cn'
import { canManageBilling, canManageTravel, enterprise, type Trip } from '../../lib/api/enterprise'
import { downloadCsv } from '../../lib/csv'
import { formatCount, formatDate, formatMoney, formatPeriod, monthToDateLabel, percentChange } from '../../lib/format'
import { queryKeys } from '../../lib/query/client'
import { useMe } from '../session/useMe'

/** The month-to-date picture a travel manager opens the console for. */
export function DashboardPage() {
  const me = useMe()
  const navigate = useNavigate()
  const travel = me.data !== undefined && canManageTravel(me.data.role)
  const billing = me.data !== undefined && canManageBilling(me.data.role)

  const dashboard = useQuery({ queryKey: queryKeys.dashboard, queryFn: enterprise.dashboard })

  const recent = useQuery({
    queryKey: queryKeys.rides.list({ recent: true }),
    queryFn: () => enterprise.trips.page(undefined, 5),
    enabled: travel,
  })

  const centres = useQuery({ queryKey: queryKeys.costCentres.all, queryFn: enterprise.costCentres.list })

  const invoices = useQuery({
    queryKey: queryKeys.invoices.list({}),
    queryFn: enterprise.invoices.list,
    enabled: billing,
  })

  const data = dashboard.data
  const now = new Date()
  const period = formatPeriod(`${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, '0')}`, now)

  function exportSummary() {
    if (data === undefined) {
      return
    }

    downloadCsv(
      `orbit-travel-overview-${now.toISOString().slice(0, 10)}.csv`,
      ['Metric', 'This month', 'Last month'],
      [
        ['Rides', data.ridesThisMonth, data.previous.rides],
        ['Travel spend', formatMoney(data.spendMinor, data.currency, { fraction: true }), formatMoney(data.previous.spendMinor, data.currency, { fraction: true })],
        ['Average cost per ride', formatMoney(data.averageFareMinor, data.currency, { fraction: true }), formatMoney(data.previous.averageFareMinor, data.currency, { fraction: true })],
        ['Policy breaches', data.policyBreaches, data.previous.policyBreaches],
        ['Active employees', data.activeEmployees, ''],
        ['Pending approvals', data.pendingApprovals, ''],
        ...(centres.data ?? []).map((centre) => [
          `Spend · ${centre.name} (${centre.code})`,
          formatMoney(centre.spendMinor, centre.currency, { fraction: true }),
          '',
        ]),
      ],
    )
  }

  const overdue = invoices.data?.find((invoice) => invoice.status === 'Overdue')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Travel overview"
        subtitle={
          me.data === undefined
            ? undefined
            : `${me.data.company.name} · ${period} · ${formatCount(me.data.company.employees)} employees`
        }
        actions={
          <>
            <Button variant="secondary" onClick={exportSummary} disabled={data === undefined}>
              Export
            </Button>
            <Button onClick={() => { void navigate({ to: '/book' }) }}>Book a ride</Button>
          </>
        }
      />

      {dashboard.isError ? (
        <LoadError error={dashboard.error} what="the dashboard" onRetry={() => { void dashboard.refetch() }} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Rides this month"
          value={data === undefined ? undefined : formatCount(data.ridesThisMonth)}
          change={data === undefined ? undefined : percentChange(data.ridesThisMonth, data.previous.rides)}
          loading={dashboard.isPending}
        />
        <StatTile
          label="Travel spend"
          value={data === undefined ? undefined : formatMoney(data.spendMinor, data.currency, { compact: true })}
          change={data === undefined ? undefined : percentChange(data.spendMinor, data.previous.spendMinor)}
          // More spend is not good news, so the arrow keeps its direction but loses its colour.
          upIsGood={false}
          loading={dashboard.isPending}
        />
        <StatTile
          label="Avg cost per ride"
          value={data === undefined ? undefined : formatMoney(data.averageFareMinor, data.currency)}
          change={data === undefined ? undefined : percentChange(data.averageFareMinor, data.previous.averageFareMinor)}
          upIsGood={false}
          loading={dashboard.isPending}
        />
        <StatTile
          label="Policy breaches"
          value={data === undefined ? undefined : formatCount(data.policyBreaches)}
          change={data === undefined ? undefined : percentChange(data.policyBreaches, data.previous.policyBreaches)}
          upIsGood={false}
          loading={dashboard.isPending}
        />
      </div>

      {travel && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">Recent rides</h2>
            <Link to="/trips" className="text-[13px] font-medium text-fg-brand hover:underline">
              View all{data === undefined ? '' : ` ${formatCount(data.ridesThisMonth)}`}
            </Link>
          </div>

          <Table<Trip>
            columns={[
              {
                key: 'employee',
                header: 'Employee',
                render: (row) => (
                  <div className="flex items-center gap-3">
                    <Avatar name={row.employeeName} size="sm" />
                    <TwoLine primary={row.employeeName} secondary={row.employeeEmail} mono />
                  </div>
                ),
              },
              { key: 'route', header: 'Route', render: (row) => <Route from={row.pickupLabel} to={row.dropoffLabel} /> },
              { key: 'cc', header: 'Cost centre', render: (row) => row.costCentre ?? '—' },
              {
                key: 'status',
                header: 'Status',
                render: (row) =>
                  row.policyBreach === null ? <StatusPill status="completed" /> : <StatusPill status="settling" label="Completed · breach" />,
              },
              {
                key: 'fare',
                header: 'Fare',
                align: 'right',
                sorted: true,
                render: (row) => <Money minorUnits={row.fareMinor} currency={row.currency} />,
              },
            ]}
            rows={recent.data?.items}
            rowKey={(row) => row.rideId}
            isPending={recent.isPending}
            emptyTitle="No rides yet this month"
            emptyHint="Completed corporate trips appear here as they happen."
            rowActions={(row) => [
              { label: 'View in trip log', onSelect: () => { void navigate({ to: '/trips', search: { q: row.rideId } }) } },
            ]}
          />
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card
          title="Spend by cost centre"
          subtitle={
            data === undefined ? monthToDateLabel(now) : `${monthToDateLabel(now)} · ${formatMoney(data.spendMinor, data.currency, { compact: true })} total`
          }
        >
          <SpendBars centres={centres.data ?? []} total={data?.spendMinor ?? 0} loading={centres.isPending} />
        </Card>

        <Card title="Needs attention" subtitle="Items an admin should act on today">
          <ul className="divide-y divide-line-subtle">
            {data !== undefined && data.pendingApprovals > 0 && (
              <Attention
                to="/approvals"
                tone="warning"
                title={`${formatCount(data.pendingApprovals)} ride${data.pendingApprovals === 1 ? '' : 's'} pending approval`}
                detail="Somebody is waiting on each of these"
              />
            )}
            {data !== undefined && data.policyBreaches > 0 && (
              <Attention
                to="/trips"
                tone="warning"
                title={`${formatCount(data.policyBreaches)} policy breach${data.policyBreaches === 1 ? '' : 'es'}`}
                detail="Trips that needed approval this month"
              />
            )}
            {overdue !== undefined && (
              <Attention
                to="/invoices"
                tone="danger"
                title={`Invoice ${overdue.invoiceId} overdue`}
                detail={`${formatMoney(overdue.totalMinor, overdue.currency, { compact: true })} · due ${formatDate(overdue.dueAt)}`}
              />
            )}
            {data !== undefined && data.neverTravelled > 0 && (
              <Attention
                to={travel ? '/employees' : '/'}
                tone="neutral"
                title={`${formatCount(data.neverTravelled)} employee${data.neverTravelled === 1 ? '' : 's'} never travelled`}
                detail="Consider removing seats"
              />
            )}
            {data !== undefined &&
              data.pendingApprovals === 0 &&
              data.policyBreaches === 0 &&
              overdue === undefined &&
              data.neverTravelled === 0 && (
                <li className="py-6 text-center text-[13px] text-fg-tertiary">Nothing needs your attention today.</li>
              )}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  change,
  upIsGood = true,
  loading,
}: {
  readonly label: string
  readonly value: string | undefined
  readonly change: number | null | undefined
  readonly upIsGood?: boolean
  readonly loading: boolean
}) {
  const up = change !== null && change !== undefined && change >= 0
  const good = change === null || change === undefined ? null : up === upIsGood

  return (
    <div className="rounded-xl border border-line-subtle bg-surface p-5 shadow-[var(--shadow-e1)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-tertiary">{label}</p>

      <p className="mt-2 font-mono text-[28px] font-semibold leading-[34px] tabular">
        {loading ? (
          // A skeleton rather than a spinner. Four spinners on one screen reads as four
          // separate problems; a block that becomes the number is one page loading.
          <span className="inline-block h-7 w-24 animate-pulse rounded bg-subtle" aria-label="Loading" />
        ) : (
          (value ?? '—')
        )}
      </p>

      <p className="mt-2 flex items-center gap-1.5 text-[12px] text-fg-tertiary">
        {change === null || change === undefined ? (
          <span>No data for last month</span>
        ) : (
          <>
            <span className={cn('inline-flex items-center gap-0.5 font-mono font-medium tabular', good === true ? 'text-fg-success' : good === false ? 'text-fg-danger' : '')}>
              <Icon name={up ? 'arrow-up' : 'arrow-down'} size={12} />
              {Math.abs(change).toFixed(1)}%
            </span>
            <span>vs last month</span>
          </>
        )}
      </p>
    </div>
  )
}

function SpendBars({
  centres,
  total,
  loading,
}: {
  readonly centres: readonly { readonly code: string; readonly name: string; readonly spendMinor: number; readonly currency: string }[]
  readonly total: number
  readonly loading: boolean
}) {
  if (loading) {
    return <p className="py-6 text-center text-[13px] text-fg-tertiary">Loading…</p>
  }

  if (centres.length === 0) {
    return <p className="py-6 text-center text-[13px] text-fg-tertiary">No cost centres yet.</p>
  }

  const sorted = [...centres].sort((a, b) => b.spendMinor - a.spendMinor)

  return (
    <ul className="space-y-4">
      {sorted.map((centre) => {
        const share = total === 0 ? 0 : (centre.spendMinor / total) * 100

        return (
          <li key={centre.code}>
            <div className="flex items-baseline justify-between gap-4 text-[13px]">
              <span className="text-fg">{centre.name}</span>
              <span className="flex items-baseline gap-2">
                <span className="font-mono text-[11px] text-fg-tertiary tabular">{share.toFixed(0)}%</span>
                <Money minorUnits={centre.spendMinor} currency={centre.currency} className="text-[13px] font-medium" />
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-subtle" role="presentation">
              <div className="h-full rounded-full bg-brand" style={{ width: `${String(Math.max(share, 1))}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function Attention({
  to,
  tone,
  title,
  detail,
}: {
  readonly to: string
  readonly tone: 'warning' | 'danger' | 'neutral'
  readonly title: string
  readonly detail: string
}) {
  return (
    <li>
      <Link to={to} className="-mx-2 block rounded-md px-2 py-3 transition-colors hover:bg-hover">
        <p className={cn('text-[14px] font-medium', tone === 'warning' && 'text-fg-warning', tone === 'danger' && 'text-fg-danger', tone === 'neutral' && 'text-fg')}>
          {title}
        </p>
        <p className="text-[12px] text-fg-tertiary">{detail}</p>
      </Link>
    </li>
  )
}
