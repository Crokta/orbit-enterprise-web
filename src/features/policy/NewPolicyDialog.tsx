import { useMutation } from '@tanstack/react-query'
import { type SyntheticEvent, useMemo, useState } from 'react'

import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Checkbox, Field, PrefixedInput, TextInput } from '../../components/ui/Inputs'
import { type Employee, type Policy, enterprise } from '../../lib/api/enterprise'
import { ApiError } from '../../lib/api/problem'
import { formatCount, formatMoney } from '../../lib/format'
import { toMinor } from './PoliciesPage'

/**
 * New travel policy.
 *
 * Policies decide what needs approval. Employees see these rules while booking, so the
 * dialog explains each rule in the words they will read.
 */
export function NewPolicyDialog({
  open,
  onClose,
  existing,
  employees,
  onCreated,
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly existing: readonly Policy[]
  readonly employees: readonly Employee[]
  readonly onCreated: (policy: Policy) => void
}) {
  const [name, setName] = useState('')
  const [cap, setCap] = useState('25000')
  const [from, setFrom] = useState('06:00')
  const [to, setTo] = useState('22:00')
  const [allowXl, setAllowXl] = useState(true)
  const [costCentre, setCostCentre] = useState(true)
  const [surge, setSurge] = useState(false)

  const standard = useMemo(
    () => [...existing].filter((policy) => policy.isActive).sort((a, b) => b.activeEmployees - a.activeEmployees)[0],
    [existing],
  )

  const capMinor = toMinor(cap)
  const unassigned = employees.filter((employee) => employee.status === 'Active' && employee.policyId === null).length

  // Set only when there is a standard policy with a cap and this one is looser than it.
  const permissive =
    standard !== undefined && standard.approvalThresholdMinor !== null && capMinor !== null && capMinor > standard.approvalThresholdMinor
      ? { name: standard.name, currency: standard.currency, theirs: standard.approvalThresholdMinor, ours: capMinor }
      : null

  const create = useMutation({
    mutationFn: () =>
      enterprise.policies.create({
        name: name.trim(),
        currency: standard?.currency ?? 'NGN',
        approvalThresholdMinor: capMinor,
        hardCapMinor: null,
        allowedClasses: allowXl ? ['Economy', 'Comfort', 'Xl'] : ['Economy', 'Comfort'],
        permittedFrom: from || null,
        permittedTo: to || null,
        requiresCostCentre: costCentre,
        requiresApprovalForSurge: surge,
      }),
    onSuccess: (policy) => { reset(); onCreated(policy) },
  })

  function reset() {
    setName(''); setCap('25000'); setFrom('06:00'); setTo('22:00'); setAllowXl(true); setCostCentre(true); setSurge(false)
    create.reset()
  }

  function submit(event: SyntheticEvent) {
    event.preventDefault()
    create.mutate()
  }

  return (
    <Dialog
      open={open}
      onClose={() => { reset(); onClose() }}
      title="New travel policy"
      subtitle="Policies decide what needs approval. Employees see these rules while booking."
      size="lg"
    >
      <form id="new-policy" onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
          <Field label="Policy name" htmlFor="policy-name">
            <TextInput id="policy-name" required value={name} placeholder="Field engineering" onChange={(event) => { setName(event.target.value); }} />
          </Field>
          <Field label="Applies to" hint="Assign employees next">
            <div className="flex h-10 items-center rounded-md border border-line bg-surface-sunken px-3 text-[15px] text-fg-secondary">
              {formatCount(unassigned)} unassigned
            </div>
          </Field>
        </div>

        <Field label="Per-ride cap" htmlFor="policy-cap" hint="Rides above this need approval before booking. Leave empty for no cap.">
          <PrefixedInput id="policy-cap" prefix="₦" inputMode="numeric" value={cap} onChange={(event) => { setCap(event.target.value); }} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Allowed from" htmlFor="policy-from">
            <TextInput id="policy-from" type="time" value={from} onChange={(event) => { setFrom(event.target.value); }} />
          </Field>
          <Field label="Allowed to" htmlFor="policy-to">
            <TextInput id="policy-to" type="time" value={to} onChange={(event) => { setTo(event.target.value); }} />
          </Field>
          <Field label="Days">
            <div className="flex h-10 items-center rounded-md border border-line bg-surface-sunken px-3 text-[15px] text-fg-secondary">Every day</div>
          </Field>
        </div>

        <fieldset className="space-y-3">
          <legend className="mb-1 text-[13px] font-medium">Rules</legend>
          <Checkbox checked={allowXl} onChange={setAllowXl} label="Allow Orbit XL" description="Field teams often travel with equipment" />
          <Checkbox checked={costCentre} onChange={setCostCentre} label="Require a cost centre" description="A booking without one goes for approval" />
          <Checkbox checked={surge} onChange={setSurge} label="Surge needs approval" description="Any surge multiplier sends the ride for approval regardless of fare" />
        </fieldset>

        {permissive !== null && (
          <Banner tone="warning" title={`This policy is more permissive than ${permissive.name}`}>
            {formatMoney(permissive.ours, permissive.currency)} cap versus {formatMoney(permissive.theirs, permissive.currency)}. Rides
            between the two would auto-approve without review.
          </Banner>
        )}

        {create.error !== null && (
          <p role="alert" className="rounded-md bg-danger-subtle px-3 py-2 text-[13px] text-fg-danger">
            {create.error instanceof ApiError ? create.error.message : 'The policy could not be created.'}
          </p>
        )}
      </form>

      <div className="flex items-center gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={() => { reset(); onClose() }}>Cancel</Button>
        <Button type="submit" form="new-policy" loading={create.isPending}>Create policy</Button>
      </div>
    </Dialog>
  )
}
