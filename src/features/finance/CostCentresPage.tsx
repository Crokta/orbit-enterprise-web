import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { LoadError } from '../../components/ui/LoadError'
import { Money } from '../../components/ui/Money'
import { PageHeader } from '../../components/ui/PageHeader'
import { Table, TwoLine } from '../../components/ui/Table'
import { useToast } from '../../components/ui/Toast'
import { canManageTravel, enterprise, type CostCentre } from '../../lib/api/enterprise'
import { downloadCsv } from '../../lib/csv'
import { formatCount, formatMoney } from '../../lib/format'
import { queryKeys } from '../../lib/query/client'
import { useMe } from '../session/useMe'
import { NewCostCentreDialog } from './NewCostCentreDialog'

/** Where the money is attributed. */
export function CostCentresPage() {
  const me = useMe()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [creating, setCreating] = useState(false)

  const centres = useQuery({ queryKey: queryKeys.costCentres.all, queryFn: enterprise.costCentres.list })
  const employees = useQuery({
    queryKey: queryKeys.employees.list({}),
    queryFn: enterprise.employees.list,
    enabled: me.data !== undefined && canManageTravel(me.data.role),
  })

  const rows = [...(centres.data ?? [])].sort((a, b) => b.spendMinor - a.spendMinor)
  const allocated = rows.reduce((sum, centre) => sum + (centre.monthlyBudgetMinor ?? 0), 0)
  const currency = rows[0]?.currency ?? 'NGN'
  const travel = me.data !== undefined && canManageTravel(me.data.role)

  function exportCentres() {
    downloadCsv(
      `orbit-cost-centres-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Code', 'Name', 'Owner', 'Employees', 'Monthly budget', 'Spent (MTD)', 'Utilisation', 'Currency'],
      rows.map((centre) => [
        centre.code,
        centre.name,
        centre.ownerName,
        centre.employees,
        centre.monthlyBudgetMinor === null ? '' : formatMoney(centre.monthlyBudgetMinor, centre.currency, { fraction: true }),
        formatMoney(centre.spendMinor, centre.currency, { fraction: true }),
        utilisation(centre) === null ? '' : `${String(utilisation(centre))}%`,
        centre.currency,
      ]),
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cost centres"
        subtitle={centres.data === undefined ? undefined : `${formatCount(rows.length)} cost centres · ${formatMoney(allocated, currency, { compact: true })} allocated this month`}
        actions={
          <>
            <Button variant="secondary" onClick={exportCentres} disabled={rows.length === 0}>Export</Button>
            {travel && <Button onClick={() => { setCreating(true); }}>New cost centre</Button>}
          </>
        }
      />

      {centres.isError ? (
        <LoadError error={centres.error} what="the cost centres" onRetry={() => { void centres.refetch() }} />
      ) : (
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
            { key: 'spent', header: 'Spent', align: 'right', sorted: true, render: (row) => <Money minorUnits={row.spendMinor} currency={row.currency} /> },
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
          ]}
          rows={rows}
          rowKey={(row) => row.code}
          isPending={centres.isPending}
          emptyTitle="No cost centres yet"
          emptyHint="Cost centres split travel spend for invoicing and reporting."
          rowActions={(row) => [
            ...(travel
              ? [{ label: 'See employees', onSelect: () => { void navigate({ to: '/employees', search: { q: row.code } }) } }]
              : []),
            { label: 'Copy code', onSelect: () => { void navigator.clipboard.writeText(row.code).then(() => { toast.notify('Code copied') }) } },
          ]}
        />
      )}

      <NewCostCentreDialog
        open={creating}
        onClose={() => { setCreating(false); }}
        employees={employees.data ?? []}
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
