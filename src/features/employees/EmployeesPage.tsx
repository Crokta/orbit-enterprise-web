import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { ChipGroup } from '../../components/ui/Chip'
import { SearchInput } from '../../components/ui/Inputs'
import { ExportButton, FilterSelect, ListToolbar, Pagination } from '../../components/ui/ListControls'
import { LoadError } from '../../components/ui/LoadError'
import { Money } from '../../components/ui/Money'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusPill } from '../../components/ui/StatusPill'
import { Table, TwoLine } from '../../components/ui/Table'
import { useToast } from '../../components/ui/Toast'
import { displayName, enterprise, type Employee, type EmployeeListParams, type Policy } from '../../lib/api/enterprise'
import { ApiError } from '../../lib/api/problem'
import { formatCount, formatMoney } from '../../lib/format'
import { useDebounced, usePagedList } from '../../lib/paging'
import { queryKeys } from '../../lib/query/client'
import { useSearchParam } from '../../lib/router'
import { useMe } from '../session/useMe'
import { EditEmployeeDialog } from './EditEmployeeDialog'
import { InviteEmployeeDialog } from './InviteEmployeeDialog'

type Filter = 'all' | 'enabled' | 'never' | 'suspended'
type RoleFilter = 'any' | 'Member' | 'TravelAdmin' | 'BillingAdmin' | 'Owner'

/**
 * Who at the company can book, and what they are spending.
 *
 * Searched, filtered and paged on the server. The roster used to arrive whole and be
 * sifted in the browser, which is fine at forty people and a table that never finishes
 * rendering at four thousand.
 */
export function EmployeesPage() {
  const me = useMe()
  const queryClient = useQueryClient()
  const toast = useToast()
  const initialQuery = useSearchParam('q')

  const [query, setQuery] = useState(initialQuery)
  const [filter, setFilter] = useState<Filter>('all')
  const [role, setRole] = useState<RoleFilter>('any')
  const [costCentre, setCostCentre] = useState('any')
  const [inviting, setInviting] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)

  const q = useDebounced(query.trim())

  const params = useMemo<EmployeeListParams>(
    () => ({
      q: q.length === 0 ? undefined : q,
      status: filter === 'enabled' ? 'Active' : filter === 'suspended' ? 'Suspended' : undefined,
      neverTravelled: filter === 'never' ? true : undefined,
      role: role === 'any' ? undefined : role,
      costCentre: costCentre === 'any' ? undefined : costCentre,
    }),
    [q, filter, role, costCentre],
  )

  const employees = usePagedList<Employee, EmployeeListParams>({
    key: queryKeys.employees.all,
    filters: params,
    fetchPage: (page) => enterprise.employees.list(page),
  })

  // Dropdown sources: bounded by the company, so one page of two hundred is the lot.
  const policies = useQuery({ queryKey: queryKeys.policies.all, queryFn: () => enterprise.policies.list({ limit: 200 }) })
  const costCentres = useQuery({ queryKey: queryKeys.costCentres.all, queryFn: () => enterprise.costCentres.list({ limit: 200 }) })

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

  const policyItems = useMemo(() => policies.data?.items ?? [], [policies.data])
  const costCentreItems = useMemo(() => costCentres.data?.items ?? [], [costCentres.data])

  const policyById = useMemo(() => new Map(policyItems.map((policy) => [policy.policyId, policy])), [policyItems])
  const defaultPolicy = useMemo(
    () => [...policyItems].filter((policy) => policy.isActive).sort((a, b) => a.policyId.localeCompare(b.policyId))[0],
    [policyItems],
  )

  const rows = employees.items
  const filtered = q.length > 0 || filter !== 'all' || role !== 'any' || costCentre !== 'any'

  return (
    <div className="space-y-5">
      <PageHeader
        title="Employees"
        subtitle={me.data === undefined ? undefined : `${formatCount(me.data.company.employees)} employees on the account`}
        actions={
          <>
            <ExportButton path={enterprise.employees.exportPath} query={{ ...params }} filename="orbit-employees.csv" />
            <Button onClick={() => { setInviting(true); }}>Invite employee</Button>
          </>
        }
      />

      <ListToolbar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, email or cost centre" className="w-[300px]" />
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
        <FilterSelect<RoleFilter>
          label="Role"
          value={role}
          onChange={setRole}
          options={[
            { value: 'any', label: 'Any role' },
            { value: 'Member', label: 'Member' },
            { value: 'TravelAdmin', label: 'Travel admin' },
            { value: 'BillingAdmin', label: 'Billing admin' },
            { value: 'Owner', label: 'Owner' },
          ]}
        />
        <FilterSelect
          label="Cost centre"
          value={costCentre}
          onChange={setCostCentre}
          options={[{ value: 'any', label: 'Any cost centre' }, ...costCentreItems.map((centre) => ({ value: centre.code, label: `${centre.code} · ${centre.name}` }))]}
        />
      </ListToolbar>

      {employees.query.isError ? (
        <LoadError error={employees.query.error} what="the employee list" onRetry={() => { void employees.query.refetch() }} />
      ) : (
        <>
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
                render: (row) => <Money minorUnits={row.monthlySpendMinor} currency={row.currency} />,
              },
            ]}
            rows={rows}
            rowKey={(row) => row.employeeId}
            isPending={employees.query.isPending}
            emptyTitle={filtered ? 'No employees match' : 'No employees have been invited yet'}
            emptyHint={filtered ? 'Try a different filter or search.' : 'Invite someone to give them a seat on the company account.'}
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

          <Pagination list={employees} />
        </>
      )}

      <InviteEmployeeDialog
        open={inviting}
        onClose={() => { setInviting(false); }}
        policies={policyItems}
        costCentres={costCentreItems}
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
        policies={policyItems}
        costCentres={costCentreItems}
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
