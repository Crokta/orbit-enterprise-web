import { useMutation } from '@tanstack/react-query'
import { type SyntheticEvent, useState } from 'react'

import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Checkbox, Field, RadioCards, TextInput } from '../../components/ui/Inputs'
import { type AdminRole, type Employee, enterprise, isAdmin } from '../../lib/api/enterprise'
import { ApiError } from '../../lib/api/problem'

/**
 * Invite admin.
 *
 * Admins can see company-wide data, so the dialog nudges towards the narrowest role that
 * works. The person must already be an employee: an admin who is not on the roster is a
 * seat with no offboarding path.
 */
export function InviteAdminDialog({
  open,
  onClose,
  employees,
  owners,
  onInvited,
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly employees: readonly Employee[]
  readonly owners: number
  readonly onInvited: (employee: Employee) => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AdminRole>('TravelAdmin')
  const [mfa, setMfa] = useState(true)

  const match = employees.find((employee) => employee.workEmail === email.trim().toLowerCase())

  const invite = useMutation({
    mutationFn: () => {
      if (match === undefined) {
        throw new ApiError({ title: 'Not an employee', status: 404, code: 'employee.not_found', detail: 'That address is not on the roster. Invite them as an employee first.' })
      }

      return enterprise.employees.setRole(match.employeeId, role)
    },
    onSuccess: (employee) => { reset(); onInvited(employee) },
  })

  function reset() {
    setEmail(''); setRole('TravelAdmin'); setMfa(true)
    invite.reset()
  }

  function submit(event: SyntheticEvent) {
    event.preventDefault()
    invite.mutate()
  }

  const alreadyAdmin = match !== undefined && isAdmin(match.role)

  return (
    <Dialog
      open={open}
      onClose={() => { reset(); onClose() }}
      title="Invite admin"
      subtitle="Admins can see company-wide data. Give the narrowest role that works."
    >
      <form id="invite-admin" onSubmit={submit} className="space-y-5">
        <Field
          label="Work email"
          htmlFor="admin-email"
          hint={match === undefined ? 'Must already be an employee' : alreadyAdmin ? `${match.displayName ?? match.workEmail} is already an admin; this changes their role.` : `${match.displayName ?? match.workEmail} · ${match.status}`}
          error={invite.error instanceof ApiError ? invite.error.message : invite.error !== null ? 'The role could not be assigned.' : undefined}
        >
          <TextInput
            id="admin-email"
            type="email"
            required
            list="admin-email-options"
            value={email}
            onChange={(event) => { setEmail(event.target.value); }}
          />
          <datalist id="admin-email-options">
            {employees.filter((employee) => !isAdmin(employee.role)).map((employee) => (
              <option key={employee.employeeId} value={employee.workEmail}>{employee.displayName ?? ''}</option>
            ))}
          </datalist>
        </Field>

        <Field label="Role">
          <RadioCards<AdminRole>
            label="Role"
            value={role}
            onChange={setRole}
            options={[
              { value: 'TravelAdmin', label: 'Travel admin', description: 'Approve rides, set policy, see rider names and routes' },
              { value: 'BillingAdmin', label: 'Billing admin', description: 'Invoices and spend only — cannot see rider names or routes' },
              { value: 'Owner', label: 'Owner', description: 'Everything, including billing, SSO and managing admins' },
            ]}
          />
        </Field>

        <Checkbox checked={mfa} onChange={setMfa} label="Require MFA before first sign-in" description="Recommended for anyone who can see rider data. Enforced by the identity service once MFA ships." />

        <Banner tone="warning" title="Owners cannot be reduced to one">
          Your organisation must keep at least two Owners so a single departure cannot lock you out.
          {owners < 2 ? ' You currently have one — inviting a second is recommended.' : ''}
        </Banner>
      </form>

      <div className="flex items-center gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={() => { reset(); onClose() }}>Cancel</Button>
        <Button type="submit" form="invite-admin" loading={invite.isPending}>Send invite</Button>
      </div>
    </Dialog>
  )
}
