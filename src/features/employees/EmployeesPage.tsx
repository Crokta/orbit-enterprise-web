import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { ChipGroup } from '../../components/ui/Chip'
import { SearchInput } from '../../components/ui/Inputs'
import { LoadError } from '../../components/ui/LoadError'
import { Money } from '../../components/ui/Money'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusPill } from '../../components/ui/StatusPill'
import { Table, TwoLine } from '../../components/ui/Table'
import { useToast } from '../../components/ui/Toast'
import { displayName, enterprise, type Employee, type Policy } from '../../lib/api/enterprise'
import { ApiError } from '../../lib/api/problem'
import { downloadCsv } from '../../lib/csv'
import { formatCount, formatMoney } from '../../lib/format'
import { queryKeys } from '../../lib/query/client'
import { useSearchParam } from '../../lib/router'
import { useMe } from '../session/useMe'
import { EditEmployeeDialog } from './EditEmployeeDialog'
import { InviteEmployeeDialog } from './InviteEmployeeDialog'

type Filter = 'all' | 'enabled' | 'never' | 'suspended'

/** Who at the company can book, and what they are spending. */
export function EmployeesPage() {
  const me = useMe()
  const queryClient = useQueryClient()
  const toast = useToast()
  const initialQuery = useSearchParam('q')

  const [query, setQuery] = useState(initialQuery)
  const [filter, setFilter] = useState<Filter>('all')
  const [inviting, setInviting] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)

  const employees = useQuery({ queryKey: queryKeys.employees.list({}), queryFn: enterprise.employees.list })
  const policies = useQuery({ queryKey: queryKeys.policies.all, queryFn: enterprise.policies.list })
  const costCentres = useQuery({ queryKey: queryKeys.costCentres.all, queryFn: enterprise.costCentres.list })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.employees.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
    void queryClient.invalidateQueries({ queryKey: queryKeys.policies.all })
  }

  const suspend = useMutation({
    mutationFn: (employee: Employee) => enterprise.employees.suspend(employee.employeeId),
    onSuccess: (employee) => { toast.notify(`${displayName(employee)} suspended`); invalidate() },
    onError: (error) => { toast.notify(describe(error, 'The employee could not be suspended.'), 'danger') },
  })

  const reinstate = useMutation({
    mutationFn: (employee: Employee) => enterprise.employees.reinstate(employee.employeeId),
    onSuccess: (employee) => { toast.notify(`${displayName(employee)} reinstated`); invalidate() },
    onError: (error) => { toast.notify(describe(error, 'The employee could not be reinstated.'), 'danger') },
  })

  const approver = useMutation({
    mutationFn: ({ employee, isApprover }: { employee: Employee; isApprover: boolean }) =>
      enterprise.employees.update(employee.employeeId, { isApprover }),
    onSuccess: (employee) => {
      toast.notify(employee.isApprover ? `${displayName(employee)} can now approve rides` : `${displayName(employee)} is no longer an approver`)
      invalidate()
    },
    onError: (error) => { toast.notify(describe(error, 'The change could not be saved.'), 'danger') },
  })

  const policyById = useMemo(() => new Map((policies.data ?? []).map((policy) => [policy.policyId, policy])), [policies.data])
  const defaultPolicy = useMemo(
    () => [...(policies.data ?? [])].filter((policy) => policy.isActive).sort((a, b) => a.policyId.localeCompare(b.policyId))[0],
    [policies.data],
  )

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return (employees.data ?? []).filter((employee) => {
      if (filter === 'enabled' && employee.status !== 'Active') return false
      if (filter === 'never' && (employee.status !== 'Active' || employee.tripsThisMonth > 0)) return false
      if (filter === 'suspended' && employee.status !== 'Suspended') return false

      if (needle.length === 0) return true

      return [employee.displayName ?? '', employee.workEmail, employee.employeeId, employee.costCentre ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [employees.data, query, filter])

  const all = employees.data ?? []
  const enabled = all.filter((employee) => employee.status === 'Active').length

  function exportRoster() {
    downloadCsv(
      `orbit-employees-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Name', 'Work email', 'Status', 'Role', 'Cost centre', 'Policy', 'Approver', 'Rides (MTD)', 'Spend (MTD)', 'Currency', 'Invited'],
      rows.map((employee) => [
        employee.displayName,
        employee.workEmail,
        employee.status,
        employee.role,
        employee.costCentre,
        policyLabel(employee, policyById, defaultPolicy),
        employee.isApprover ? 'Yes' : 'No',
        employee.tripsThisMonth,
        formatMoney(employee.monthlySpendMinor, employee.currency, { fraction: true }),
        employee.currency,
        employee.invitedAt,
      ]),
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Employees"
        subtitle={employees.data === undefined ? undefined : `${formatCount(all.length)} employees · ${formatCount(enabled)} with travel enabled`}
        actions={
          <>
            <Button variant="secondary" onClick={exportRoster} disabled={rows.length === 0}>Export</Button>
            <Button onClick={() => { setInviting(true); }}>Invite employee</Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-4">
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, email or ID" className="w-[320px]" />
        <ChipGroup<Filter>
          label="Filter employees"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'enabled', label: 'Travel enabled' },
            { value: 'never', label: 'Never travelled' },
            { value: 'suspended', label: 'Suspended' },
          ]}
        />
      </div>

      {employees.isError ? (
        <LoadError error={employees.error} what="the employee list" onRetry={() => { void employees.refetch() }} />
      ) : (
        <Table<Employee>
          minWidth={960}
          columns={[
            {
              key: 'employee',
              header: 'Employee',
              render: (row) => (
                <div className="flex items-center gap-3">
                  <Avatar name={displayName(row)} size="sm" />
                  <TwoLine primary={displayName(row)} secondary={row.workEmail} mono />
                </div>
              ),
            },
            { key: 'cc', header: 'Cost centre', render: (row) => row.costCentre ?? <span className="text-fg-tertiary">—</span> },
            { key: 'policy', header: 'Policy', render: (row) => policyLabel(row, policyById, defaultPolicy) },
            {
              key: 'status',
              header: 'Status',
              render: (row) => (
                <div className="flex items-center gap-2">
                  <StatusPill status={row.status === 'Active' ? 'active' : row.status === 'Invited' ? 'invited' : 'suspended'} />
                  {row.isApprover && <span className="text-[11px] font-medium text-fg-tertiary">Approver</span>}
                </div>
              ),
            },
            { key: 'rides', header: 'Rides (MTD)', align: 'right', render: (row) => <span className="font-mono tabular">{row.tripsThisMonth}</span> },
            {
              key: 'spend',
              header: 'Spend (MTD)',
              align: 'right',
              sorted: true,
              render: (row) => <Money minorUnits={row.monthlySpendMinor} currency={row.currency} />,
            },
          ]}
          rows={rows}
          rowKey={(row) => row.employeeId}
          isPending={employees.isPending}
          emptyTitle={query.length > 0 || filter !== 'all' ? 'No employees match' : 'No employees have been invited yet'}
          emptyHint={query.length > 0 || filter !== 'all' ? 'Try a different filter or search.' : 'Invite someone to give them a seat on the company account.'}
          rowActions={(row) => {
            const self = row.employeeId === me.data?.employeeId

            return [
              { label: 'Edit cost centre or policy', onSelect: () => { setEditing(row) } },
              {
                label: row.isApprover ? 'Remove as approver' : 'Make an approver',
                onSelect: () => { approver.mutate({ employee: row, isApprover: !row.isApprover }) },
              },
              row.status === 'Suspended'
                ? { label: 'Reinstate', onSelect: () => { reinstate.mutate(row) } }
                : { label: 'Suspend access', tone: 'danger', disabled: self, onSelect: () => { suspend.mutate(row) } },
            ]
          }}
        />
      )}

      <InviteEmployeeDialog
        open={inviting}
        onClose={() => { setInviting(false); }}
        policies={policies.data ?? []}
        costCentres={costCentres.data ?? []}
        verifiedDomain={me.data?.company.verifiedDomain ?? null}
        onInvited={(employee) => {
          setInviting(false)
          toast.notify(`Invitation sent to ${employee.workEmail}`)
          invalidate()
        }}
      />

      <EditEmployeeDialog
        employee={editing}
        onClose={() => { setEditing(null); }}
        policies={policies.data ?? []}
        costCentres={costCentres.data ?? []}
        onSaved={(employee) => {
          setEditing(null)
          toast.notify(`${displayName(employee)} updated`)
          invalidate()
        }}
      />
    </div>
  )
}

/** "Standard — ₦15k cap", or the company default when none is assigned. */
export function policyLabel(
  employee: { readonly policyId: string | null },
  policies: ReadonlyMap<string, Policy>,
  fallback: Policy | undefined,
): string {
  const policy = (employee.policyId === null ? undefined : policies.get(employee.policyId)) ?? fallback

  if (policy === undefined) {
    return 'No policy'
  }

  return policy.approvalThresholdMinor === null
    ? `${policy.name} — no cap`
    : `${policy.name} — ${shortMoney(policy.approvalThresholdMinor, policy.currency)} cap`
}

/** "₦15k", "₦1.2M" — the shorthand the roster uses for caps. */
export function shortMoney(minor: number, currency: string): string {
  const major = minor / 100

  if (major >= 1_000_000) {
    return formatMoney(minor, currency, { compact: true })
  }

  if (major >= 1_000 && major % 1_000 === 0) {
    return `${formatMoney(0, currency).replace('0', '')}${String(major / 1_000)}k`
  }

  return formatMoney(minor, currency)
}

export function describe(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.status < 500 ? error.message : fallback
}
