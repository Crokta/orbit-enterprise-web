import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { SearchInput } from '../../components/ui/Inputs'
import { ExportButton, FilterSelect, ListToolbar, Pagination } from '../../components/ui/ListControls'
import { LoadError } from '../../components/ui/LoadError'
import { Money } from '../../components/ui/Money'
import { PageHeader } from '../../components/ui/PageHeader'
import { Table, TwoLine } from '../../components/ui/Table'
import { useToast } from '../../components/ui/Toast'
import { canManageTravel, enterprise, type CostCentre } from '../../lib/api/enterprise'
import { formatCount } from '../../lib/format'
import { useDebounced, usePagedList } from '../../lib/paging'
import { queryKeys } from '../../lib/query/client'
import { useMe } from '../session/useMe'
import { NewCostCentreDialog } from './NewCostCentreDialog'

type ActiveFilter = 'all' | 'active' | 'retired'

/** Where the money is attributed. */
export function CostCentresPage() {
  const me = useMe()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<ActiveFilter>('all')

  const q = useDebounced(query.trim())
  const params = useMemo(
    () => ({ q: q.length === 0 ? undefined : q, active: active === 'all' ? undefined : active === 'active' }),
    [q, active],
  )

  const centres = usePagedList<CostCentre, typeof params>({
    key: queryKeys.costCentres.all,
    filters: params,
    fetchPage: (page) => enterprise.costCentres.list(page),
  })

  const travel = me.data !== undefined && canManageTravel(me.data.role)

  const employees = useQuery({
    queryKey: queryKeys.employees.list({ forDialog: true }),
    queryFn: () => enterprise.employees.list({ status: 'Active', limit: 200 }),
    enabled: travel,
  })

  const rows = centres.items
  const allocated = rows.reduce((sum, centre) => sum + (centre.monthlyBudgetMinor ?? 0), 0)
  const currency = rows[0]?.currency ?? me.data?.currency ?? 'NGN'

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cost centres"
        subtitle={centres.query.data === undefined ? undefined : `${formatCount(rows.length)}${centres.hasNext ? '+' : ''} cost centres · budgets on this page ${new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(allocated / 100)}`}
        actions={
          <>
            <ExportButton path={enterprise.costCentres.exportPath} query={params} filename="orbit-cost-centres.csv" />
            {travel && <Button onClick={() => { setCreating(true); }}>New cost centre</Button>}
          </>
        }
      />

      <ListToolbar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search code or name" className="w-[280px]" />
        <FilterSelect<ActiveFilter>
          label="Status"
          value={active}
          onChange={setActive}
          options={[
            { value: 'all', label: 'Active and retired' },
            { value: 'active', label: 'Active' },
            { value: 'retired', label: 'Retired' },
          ]}
        />
      </ListToolbar>

      {centres.query.isError ? (
        <LoadError error={centres.query.error} what="the cost centres" onRetry={() => { void centres.query.refetch() }} />
      ) : (
        <>
          <Table<CostCentre>
            minWidth={900}
            columns={[
              { key: 'centre', header: 'Cost centre', render: (row) => <TwoLine primary={row.name} secondary={row.code} mono /> },
              { key: 'owner', header: 'Owner', render: (row) => row.ownerName },
              { key: 'employees', header: 'Employees', align: 'right', render: (row) => <span className="font-mono tabular">{row.employees}</span> },
              {
                key: 'budget',
                header: 'Monthly budget',
                align: 'right',
                render: (row) =>
                  row.monthlyBudgetMinor === null ? (
                    // An em dash, not a zero. "No budget set" and "a budget of nothing" are
                    // different facts and must not look identical.
                    <span className="text-fg-tertiary">—</span>
                  ) : (
                    <Money minorUnits={row.monthlyBudgetMinor} currency={row.currency} />
                  ),
              },
              { key: 'spent', header: 'Spent', align: 'right', render: (row) => <Money minorUnits={row.spendMinor} currency={row.currency} /> },
              {
                key: 'utilisation',
                header: 'Utilisation',
                render: (row) => {
                  const used = utilisation(row)

                  return used === null ? (
                    <Badge tone="neutral">Unbudgeted</Badge>
                  ) : (
                    <Badge tone={used >= 100 ? 'danger' : used >= 80 ? 'warning' : used >= 60 ? 'neutral' : 'success'}>{used}% used</Badge>
                  )
                },
              },
              { key: 'active', header: 'Status', render: (row) => <Badge tone={row.isActive ? 'success' : 'neutral'}>{row.isActive ? 'Active' : 'Retired'}</Badge> },
            ]}
            rows={rows}
            rowKey={(row) => row.code}
            isPending={centres.query.isPending}
            emptyTitle={q.length > 0 || active !== 'all' ? 'No cost centres match' : 'No cost centres yet'}
            emptyHint={q.length > 0 || active !== 'all' ? 'Try another search or filter.' : 'Cost centres split travel spend for invoicing and reporting.'}
            rowActions={(row) => [
              ...(travel
                ? [{ label: 'See employees', onSelect: () => { void navigate({ to: '/employees', search: { q: row.code } }) } }]
                : []),
              { label: 'Copy code', onSelect: () => { void navigator.clipboard.writeText(row.code).then(() => { toast.notify('Code copied') }) } },
            ]}
          />

          <Pagination list={centres} />
        </>
      )}

      <NewCostCentreDialog
        open={creating}
        onClose={() => { setCreating(false); }}
        employees={employees.data?.items ?? []}
        existingCodes={rows.map((centre) => centre.code)}
        currency={currency}
        onCreated={(centre) => {
          setCreating(false)
          toast.notify(`${centre.name} created`)
          void queryClient.invalidateQueries({ queryKey: queryKeys.costCentres.all })
        }}
      />
    </div>
  )
}

/** Percent of the monthly budget spent, or null when there is no budget. */
export function utilisation(centre: { readonly monthlyBudgetMinor: number | null; readonly spendMinor: number }): number | null {
  if (centre.monthlyBudgetMinor === null || centre.monthlyBudgetMinor === 0) {
    return null
  }

  return Math.round((centre.spendMinor / centre.monthlyBudgetMinor) * 100)
}
