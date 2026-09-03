import { useQuery } from '@tanstack/react-query'

import { Money } from '../../components/ui/Money'
import { api } from '../../lib/api/client'

interface DashboardSummary {
  readonly ridesThisMonth: number
  readonly spendMinor: number
  readonly currency: string
  readonly activeEmployees: number
  readonly pendingApprovals: number
  readonly policyBreaches: number
  readonly averageFareMinor: number
}

/** The month-to-date picture a travel manager opens the console for. */
export function DashboardPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.get<DashboardSummary>('/v1/enterprise/dashboard'),
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[28px] font-semibold leading-[34px]">Dashboard</h1>
        <p className="text-[13px] text-fg-secondary">Month to date</p>
      </header>

      {isError ? (
        <p role="alert" className="rounded-md bg-danger-subtle px-4 py-3 text-[13px] text-fg-danger">
          The dashboard could not be loaded. Everything else in the console still works.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Rides" value={data?.ridesThisMonth} loading={isPending} />
        <StatTile
          label="Spend"
          loading={isPending}
          value={data === undefined ? undefined : undefined}
          rendered={
            data === undefined ? null : <Money minorUnits={data.spendMinor} currency={data.currency} />
          }
        />
        <StatTile label="Active employees" value={data?.activeEmployees} loading={isPending} />
        <StatTile
          label="Awaiting approval"
          value={data?.pendingApprovals}
          loading={isPending}
          // Drawn in the warning colour only when there is something to act on. A tile
          // that is permanently amber stops meaning anything, which is how a queue with
          // real work in it gets ignored.
          tone={data !== undefined && data.pendingApprovals > 0 ? 'warning' : 'neutral'}
        />
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  rendered,
  loading,
  tone = 'neutral',
}: {
  readonly label: string
  readonly value?: number | undefined
  readonly rendered?: React.ReactNode
  readonly loading: boolean
  readonly tone?: 'neutral' | 'warning'
}) {
  return (
    <div className="rounded-lg border border-line-subtle bg-surface p-4 shadow-[var(--shadow-e1)]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-tertiary">{label}</p>

      <p
        className={`mt-1 text-[28px] font-semibold leading-[34px] ${
          tone === 'warning' ? 'text-fg-warning' : 'text-fg'
        }`}
      >
        {loading ? (
          // A skeleton rather than a spinner. Four spinners on one screen reads as four
          // separate problems; a block that becomes the number is one page loading.
          <span className="inline-block h-7 w-20 animate-pulse rounded bg-subtle" aria-label="Loading" />
        ) : (
          (rendered ?? value?.toLocaleString('en-NG') ?? '—')
        )}
      </p>
    </div>
  )
}
