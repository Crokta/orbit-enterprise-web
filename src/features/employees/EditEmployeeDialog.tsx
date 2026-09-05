import { useMutation } from '@tanstack/react-query'
import { type SyntheticEvent, useEffect, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Checkbox, Field, Select, TextInput } from '../../components/ui/Inputs'
import { type CostCentre, type Employee, type Policy, displayName, enterprise } from '../../lib/api/enterprise'
import { ApiError } from '../../lib/api/problem'

/** Moves an employee between cost centres or policies, or renames them. */
export function EditEmployeeDialog({
  employee,
  onClose,
  policies,
  costCentres,
  onSaved,
}: {
  readonly employee: Employee | null
  readonly onClose: () => void
  readonly policies: readonly Policy[]
  readonly costCentres: readonly CostCentre[]
  readonly onSaved: (employee: Employee) => void
}) {
  const [name, setName] = useState('')
  const [costCentre, setCostCentre] = useState('')
  const [policyId, setPolicyId] = useState('')
  const [visitors, setVisitors] = useState(false)

  useEffect(() => {
    if (employee !== null) {
      setName(employee.displayName ?? '')
      setCostCentre(employee.costCentre ?? '')
      setPolicyId(employee.policyId ?? '')
      setVisitors(employee.canBookForVisitors)
    }
  }, [employee])

  const save = useMutation({
    mutationFn: () => {
      if (employee === null) {
        throw new Error('No employee selected')
      }

      return enterprise.employees.update(employee.employeeId, {
        displayName: name.trim(),
        costCentre,
        policyId,
        canBookForVisitors: visitors,
      })
    },
    onSuccess: onSaved,
  })

  function submit(event: SyntheticEvent) {
    event.preventDefault()
    save.mutate()
  }

  return (
    <Dialog
      open={employee !== null}
      onClose={onClose}
      title={employee === null ? 'Edit employee' : displayName(employee)}
      subtitle={employee?.workEmail}
    >
      <form id="edit-employee" onSubmit={submit} className="space-y-5">
        <Field label="Display name" htmlFor="edit-name" hint="Shown on the roster, approvals and the trip log">
          <TextInput id="edit-name" value={name} onChange={(event) => { setName(event.target.value); }} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cost centre" htmlFor="edit-cc">
            <Select id="edit-cc" value={costCentre} onChange={(event) => { setCostCentre(event.target.value); }}>
              <option value="">No cost centre</option>
              {costCentres.map((centre) => (
                <option key={centre.code} value={centre.code}>{centre.name} · {centre.code}</option>
              ))}
            </Select>
          </Field>
          <Field label="Travel policy" htmlFor="edit-policy">
            <Select id="edit-policy" value={policyId} onChange={(event) => { setPolicyId(event.target.value); }}>
              <option value="">Company default</option>
              {policies.map((policy) => (
                <option key={policy.policyId} value={policy.policyId}>{policy.name}{policy.isActive ? '' : ' (retired)'}</option>
              ))}
            </Select>
          </Field>
        </div>

        <Checkbox checked={visitors} onChange={setVisitors} label="Allow booking for visitors" description="Lets them book rides for candidates and clients" />

        {save.error !== null && (
          <p role="alert" className="rounded-md bg-danger-subtle px-3 py-2 text-[13px] text-fg-danger">
            {save.error instanceof ApiError ? save.error.message : 'The change could not be saved.'}
          </p>
        )}
      </form>

      <div className="flex items-center gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="edit-employee" loading={save.isPending}>Save changes</Button>
      </div>
    </Dialog>
  )
}
