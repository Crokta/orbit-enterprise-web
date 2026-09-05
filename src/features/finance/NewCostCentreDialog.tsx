import { useMutation } from '@tanstack/react-query'
import { type SyntheticEvent, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Checkbox, Field, PrefixedInput, Select, TextInput } from '../../components/ui/Inputs'
import { type CostCentre, type Employee, displayName, enterprise } from '../../lib/api/enterprise'
import { ApiError } from '../../lib/api/problem'
import { toMinor } from '../policy/PoliciesPage'

/**
 * New cost centre.
 *
 * The code is suggested from the name — CC-CS-06 for "Customer Success" — because a code
 * an admin types freehand is one that collides with the finance system's next month.
 */
export function NewCostCentreDialog({
  open,
  onClose,
  employees,
  existingCodes,
  currency,
  onCreated,
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly employees: readonly Employee[]
  readonly existingCodes: readonly string[]
  readonly currency: string
  readonly onCreated: (centre: CostCentre) => void
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [codeEdited, setCodeEdited] = useState(false)
  const [owner, setOwner] = useState('')
  const [budget, setBudget] = useState('')
  const [alertAt, setAlertAt] = useState('80')
  const [block, setBlock] = useState(true)

  const suggested = suggestCode(name, existingCodes)
  const effectiveCode = codeEdited ? code : suggested

  const create = useMutation({
    mutationFn: () =>
      enterprise.costCentres.create({
        code: effectiveCode.trim().toUpperCase(),
        name: name.trim(),
        monthlyBudgetMinor: toMinor(budget),
        currency,
        ownerEmployeeId: owner || null,
      }),
    onSuccess: (centre) => { reset(); onCreated(centre) },
  })

  function reset() {
    setName(''); setCode(''); setCodeEdited(false); setOwner(''); setBudget(''); setAlertAt('80'); setBlock(true)
    create.reset()
  }

  function submit(event: SyntheticEvent) {
    event.preventDefault()
    create.mutate()
  }

  const owners = employees.filter((employee) => employee.status !== 'Suspended')

  return (
    <Dialog
      open={open}
      onClose={() => { reset(); onClose() }}
      title="New cost centre"
      subtitle="Cost centres split travel spend for invoicing and reporting."
    >
      <form id="new-cost-centre" onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Field label="Name" htmlFor="cc-name">
            <TextInput id="cc-name" required value={name} placeholder="Customer Success" onChange={(event) => { setName(event.target.value); }} />
          </Field>
          <Field label="Code" htmlFor="cc-code" hint={codeEdited ? undefined : 'Auto-generated'}>
            <TextInput
              id="cc-code"
              required
              value={effectiveCode}
              pattern="[A-Za-z0-9-]+"
              title="Letters, digits and hyphens"
              onChange={(event) => { setCode(event.target.value.toUpperCase()); setCodeEdited(true); }}
              className="font-mono uppercase"
            />
          </Field>
        </div>

        <Field label="Owner" htmlFor="cc-owner" hint="Receives budget alerts and approves over-cap rides">
          <Select id="cc-owner" value={owner} onChange={(event) => { setOwner(event.target.value); }}>
            <option value="">Me</option>
            {owners.map((employee) => (
              <option key={employee.employeeId} value={employee.employeeId}>
                {displayName(employee)} · {employee.workEmail}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Monthly budget" htmlFor="cc-budget" hint="Leave empty for unbudgeted">
            <PrefixedInput id="cc-budget" prefix="₦" inputMode="numeric" value={budget} placeholder="800,000" onChange={(event) => { setBudget(event.target.value); }} />
          </Field>
          <Field label="Alert at" htmlFor="cc-alert" hint="Owner is emailed at this threshold">
            <Select id="cc-alert" value={alertAt} onChange={(event) => { setAlertAt(event.target.value); }}>
              {['50', '70', '80', '90', '100'].map((value) => (
                <option key={value} value={value}>{value}% used</option>
              ))}
            </Select>
          </Field>
        </div>

        <Checkbox
          checked={block}
          onChange={setBlock}
          label="Block new rides when budget is exhausted"
          description="Employees see a clear message and can request an exception. Leaving this off lets spend run over."
        />

        {create.error !== null && (
          <p role="alert" className="rounded-md bg-danger-subtle px-3 py-2 text-[13px] text-fg-danger">
            {create.error instanceof ApiError
              ? create.error.code === 'cost_centre.duplicate'
                ? 'That code is already in use. Choose another.'
                : create.error.message
              : 'The cost centre could not be created.'}
          </p>
        )}
      </form>

      <div className="flex items-center gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={() => { reset(); onClose() }}>Cancel</Button>
        <Button type="submit" form="new-cost-centre" loading={create.isPending}>Create cost centre</Button>
      </div>
    </Dialog>
  )
}

/** "Customer Success" → "CC-CS-06", skipping codes already taken. */
export function suggestCode(name: string, existing: readonly string[]): string {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 0)

  if (words.length === 0) {
    return ''
  }

  const letters = words.length === 1 ? (words[0] ?? '').slice(0, 3) : words.map((word) => word[0] ?? '').join('').slice(0, 3)
  const taken = new Set(existing.map((code) => code.toUpperCase()))

  for (let n = existing.length + 1; n < existing.length + 100; n += 1) {
    const candidate = `CC-${letters.toUpperCase()}-${String(n).padStart(2, '0')}`

    if (!taken.has(candidate)) {
      return candidate
    }
  }

  return `CC-${letters.toUpperCase()}`
}
