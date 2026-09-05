import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { LoadError } from '../../components/ui/LoadError'
import { type MenuItem } from '../../components/ui/Menu'
import { PageHeader } from '../../components/ui/PageHeader'
import { Table, TwoLine } from '../../components/ui/Table'
import { useToast } from '../../components/ui/Toast'
import { ROLE_LABELS, type AdminRole, type Employee, displayName, enterprise, isAdmin } from '../../lib/api/enterprise'
import { ApiError } from '../../lib/api/problem'
import { downloadCsv } from '../../lib/csv'
import { formatCount, formatRelative } from '../../lib/format'
import { queryKeys } from '../../lib/query/client'
import { useMe } from '../session/useMe'
import { InviteAdminDialog } from './InviteAdminDialog'

const ROLE_CARDS: readonly {
  readonly role: AdminRole
  readonly summary: string
  readonly can: readonly string[]
  readonly cannot: readonly string[]
}[] = [
  {
    role: 'Owner',
    summary: 'Full control including billing and SSO',
    can: ['Everything a travel admin can do', 'Manage admins and roles', 'Disconnect SSO, rotate API keys'],
    cannot: [],
  },
  {
    role: 'TravelAdmin',
    summary: 'Day-to-day travel operations',
    can: ['Approve rides and set policy', 'See rider names and routes', 'Manage employees and cost centres'],
    cannot: ['Cannot change billing or SSO', 'Cannot manage other admins'],
  },
  {
    role: 'BillingAdmin',
    summary: 'Finance and invoicing only',
    can: ['See and pay invoices', 'See spend by cost centre', 'Export financial reports'],
    cannot: ['Cannot see rider names', 'Cannot see ride routes', 'Cannot approve rides'],
  },
]

/** Admin users: who runs the account, and what each role can do. */
export function AdminUsersPage() {
  const me = useMe()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [inviting, setInviting] = useState(false)

  const employees = useQuery({ queryKey: queryKeys.employees.list({}), queryFn: enterprise.employees.list })

  const setRole = useMutation({
    mutationFn: ({ employee, role }: { employee: Employee; role: AdminRole }) => enterprise.employees.setRole(employee.employeeId, role),
    onSuccess: (employee) => {
      toast.notify(employee.role === 'Member' ? `${displayName(employee)} is no longer an admin` : `${displayName(employee)} is now ${ROLE_LABELS[employee.role].toLowerCase()}`)
      void queryClient.invalidateQueries({ queryKey: queryKeys.employees.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.me })
    },
    onError: (error) => {
      toast.notify(error instanceof ApiError && error.code === 'employee.last_owner' ? 'An organisation must keep at least two owners.' : error instanceof ApiError ? error.message : 'The role could not be changed.', 'danger')
    },
  })

  const admins = (employees.data ?? []).filter((employee) => isAdmin(employee.role) && employee.status !== 'Suspended')
  const owners = admins.filter((employee) => employee.role === 'Owner').length

  function exportAdmins() {
    downloadCsv(
      `orbit-admins-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Name', 'Work email', 'Role', 'Can see rider data', 'Status', 'Activated'],
      admins.map((employee) => [displayName(employee), employee.workEmail, ROLE_LABELS[employee.role], employee.role === 'BillingAdmin' ? 'No' : 'Yes', employee.status, employee.activatedAt]),
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Admin users"
        subtitle={employees.data === undefined ? undefined : `${formatCount(admins.length)} admins · roles control what each can see and change`}
        actions={
          <>
            <Button variant="secondary" onClick={exportAdmins} disabled={admins.length === 0}>Export</Button>
            <Button onClick={() => { setInviting(true); }}>Invite admin</Button>
          </>
        }
      />

      <Banner tone="info">
        An organisation must keep at least two Owners. Billing admins can see invoices but never ride routes or rider names.
      </Banner>

      {employees.isError ? (
        <LoadError error={employees.error} what="the admin list" onRetry={() => { void employees.refetch() }} />
      ) : (
        <Table<Employee>
          columns={[
            {
              key: 'admin',
              header: 'Admin',
              render: (row) => (
                <div className="flex items-center gap-3">
                  <Avatar name={displayName(row)} size="sm" />
                  <TwoLine primary={displayName(row)} secondary={row.workEmail} mono />
                </div>
              ),
            },
            { key: 'role', header: 'Role', render: (row) => ROLE_LABELS[row.role] },
            { key: 'rider', header: 'Can see rider data', render: (row) => <Badge tone={row.role === 'BillingAdmin' ? 'success' : 'neutral'}>{row.role === 'BillingAdmin' ? 'No' : 'Yes'}</Badge> },
            { key: 'status', header: 'Status', render: (row) => <Badge tone={row.status === 'Active' ? 'success' : 'warning'}>{row.status}</Badge> },
            { key: 'active', header: 'Since', render: (row) => (row.activatedAt === null ? <span className="text-fg-tertiary">Not yet signed in</span> : formatRelative(row.activatedAt)) },
          ]}
          rows={admins}
          rowKey={(row) => row.employeeId}
          isPending={employees.isPending}
          emptyTitle="No admins yet"
          rowActions={(row) => {
            const self = row.employeeId === me.data?.employeeId
            const lastOwner = row.role === 'Owner' && owners <= 2

            const options: readonly { readonly role: AdminRole; readonly label: string }[] = [
              { role: 'Owner', label: 'Make owner' },
              { role: 'TravelAdmin', label: 'Make travel admin' },
              { role: 'BillingAdmin', label: 'Make billing admin' },
            ]

            const items: MenuItem[] = options
              .filter((option) => option.role !== row.role)
              .map((option) => ({
                label: option.label,
                disabled: lastOwner,
                onSelect: () => { setRole.mutate({ employee: row, role: option.role }) },
              }))

            items.push({
              label: 'Remove admin access',
              tone: 'danger',
              disabled: self || lastOwner,
              onSelect: () => { setRole.mutate({ employee: row, role: 'Member' }) },
            })

            return items
          }}
        />
      )}

      <section className="rounded-xl border border-line-subtle bg-surface p-4 shadow-[var(--shadow-e1)]">
        <h2 className="mb-3 text-[16px] font-semibold">What each role can do</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {ROLE_CARDS.map((card) => (
            <div key={card.role} className="rounded-lg border border-line-subtle bg-surface-sunken p-4">
              <p className="text-[15px] font-semibold">{ROLE_LABELS[card.role]}</p>
              <p className="text-[12px] text-fg-tertiary">{card.summary}</p>
              <ul className="mt-3 space-y-1.5 text-[13px]">
                {card.can.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-fg">
                    <Icon name="check" size={14} className="mt-1 shrink-0 text-fg-success" />
                    {line}
                  </li>
                ))}
                {card.cannot.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-fg-secondary">
                    <Icon name="warning" size={14} className="mt-1 shrink-0 text-fg-tertiary" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <InviteAdminDialog
        open={inviting}
        onClose={() => { setInviting(false); }}
        employees={(employees.data ?? []).filter((employee) => employee.status !== 'Suspended')}
        owners={owners}
        onInvited={(employee) => {
          setInviting(false)
          toast.notify(`${displayName(employee)} is now ${ROLE_LABELS[employee.role].toLowerCase()}`)
          void queryClient.invalidateQueries({ queryKey: queryKeys.employees.all })
        }}
      />
    </div>
  )
}
