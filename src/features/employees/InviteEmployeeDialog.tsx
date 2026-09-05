import { useMutation } from '@tanstack/react-query'
import { type SyntheticEvent, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Checkbox, Field, Select, TextInput } from '../../components/ui/Inputs'
import { type CostCentre, type Employee, type Policy, enterprise } from '../../lib/api/enterprise'
import { ApiError } from '../../lib/api/problem'
import { formatMoney } from '../../lib/format'

/**
 * Invite employee.
 *
 * They receive an email invite. Seats are billed from the first ride, not from the
 * invitation, which is why sending one to the whole company at once is cheap.
 */
export function InviteEmployeeDialog({
  open,
  onClose,
  policies,
  costCentres,
  verifiedDomain,
  onInvited,
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly policies: readonly Policy[]
  readonly costCentres: readonly CostCentre[]
  readonly verifiedDomain: string | null
  readonly onInvited: (employee: Employee) => void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [costCentre, setCostCentre] = useState('')
  const [policyId, setPolicyId] = useState('')
  const [sendNow, setSendNow] = useState(true)
  const [visitors, setVisitors] = useState(false)
  const [approver, setApprover] = useState(false)

  const invite = useMutation({
    mutationFn: () =>
      enterprise.employees.invite({
        workEmail: email.trim(),
        displayName: `${firstName} ${lastName}`.trim() || null,
        costCentre: costCentre || null,
        policyId: policyId || null,
        isApprover: approver,
        canBookForVisitors: visitors,
      }),
    onSuccess: (employee) => {
      reset()
      onInvited(employee)
    },
  })

  function reset() {
    setFirstName(''); setLastName(''); setEmail(''); setCostCentre(''); setPolicyId('')
    setSendNow(true); setVisitors(false); setApprover(false)
    invite.reset()
  }

  function submit(event: SyntheticEvent) {
    event.preventDefault()
    invite.mutate()
  }

  // The domain the address must be on, or null when the company accepts any address.
  const requiredDomain = verifiedDomain !== null && email.includes('@') && !email.trim().toLowerCase().endsWith(`@${verifiedDomain}`) ? verifiedDomain : null
  const domainMismatch = requiredDomain !== null

  const error =
    invite.error instanceof ApiError
      ? invite.error.code === 'employee.already_invited'
        ? 'That address has already been invited.'
        : invite.error.message
      : invite.error !== null
        ? 'The invitation could not be sent. Please try again.'
        : undefined

  return (
    <Dialog
      open={open}
      onClose={() => { reset(); onClose() }}
      title="Invite employee"
      subtitle="They receive an email invite. Seats are billed from first ride, not from invite."
    >
      <form id="invite-employee" onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="invite-first">
            <TextInput id="invite-first" value={firstName} autoComplete="off" onChange={(event) => { setFirstName(event.target.value); }} />
          </Field>
          <Field label="Last name" htmlFor="invite-last">
            <TextInput id="invite-last" value={lastName} autoComplete="off" onChange={(event) => { setLastName(event.target.value); }} />
          </Field>
        </div>

        <Field
          label="Work email"
          htmlFor="invite-email"
          hint={verifiedDomain === null ? undefined : `Must match your verified domain, @${verifiedDomain}`}
          error={requiredDomain !== null ? `Work addresses must be on @${requiredDomain}.` : error}
        >
          <TextInput
            id="invite-email"
            type="email"
            required
            value={email}
            placeholder={verifiedDomain === null ? 'name@company.com' : `name@${verifiedDomain}`}
            onChange={(event) => { setEmail(event.target.value); }}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cost centre" htmlFor="invite-cc">
            <Select id="invite-cc" value={costCentre} onChange={(event) => { setCostCentre(event.target.value); }}>
              <option value="">No cost centre</option>
              {costCentres.map((centre) => (
                <option key={centre.code} value={centre.code}>{centre.name} · {centre.code}</option>
              ))}
            </Select>
          </Field>
          <Field label="Travel policy" htmlFor="invite-policy">
            <Select id="invite-policy" value={policyId} onChange={(event) => { setPolicyId(event.target.value); }}>
              <option value="">Company default</option>
              {policies.filter((policy) => policy.isActive).map((policy) => (
                <option key={policy.policyId} value={policy.policyId}>
                  {policy.name}{policy.approvalThresholdMinor === null ? '' : ` — ${formatMoney(policy.approvalThresholdMinor, policy.currency)} cap`}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="space-y-3">
          <Checkbox checked={sendNow} onChange={setSendNow} label="Send invite now" description="Otherwise it stays a draft you can send later" />
          <Checkbox checked={visitors} onChange={setVisitors} label="Allow booking for visitors" description="Lets them book rides for candidates and clients" />
          <Checkbox checked={approver} onChange={setApprover} label="Make them an approver" description="They can approve rides for their cost centre" />
        </div>
      </form>

      <div className="flex items-center gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={() => { reset(); onClose() }}>Cancel</Button>
        <Button type="submit" form="invite-employee" loading={invite.isPending} disabled={domainMismatch}>
          {sendNow ? 'Send invite' : 'Save draft'}
        </Button>
      </div>
    </Dialog>
  )
}
