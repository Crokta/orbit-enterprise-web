import { useMutation } from '@tanstack/react-query'
import { type SyntheticEvent, useState } from 'react'

import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { DefinitionRow } from '../../components/ui/Card'
import { Dialog } from '../../components/ui/Dialog'
import { Checkbox, Field, RadioCards, TextInput } from '../../components/ui/Inputs'
import { useToast } from '../../components/ui/Toast'
import { type ApiKeyCreated, type ApiKeyEnvironment, type ApiKeyScope, enterprise } from '../../lib/api/enterprise'
import { ApiError } from '../../lib/api/problem'
import { downloadText } from '../../lib/csv'
import { formatDate, formatTime } from '../../lib/format'
import { SCOPE_LABELS } from './ApiKeysPage'

const SCOPES: readonly { readonly value: ApiKeyScope; readonly description: string; readonly warning?: boolean }[] = [
  { value: 'ReadTrips', description: 'Ride records, routes and fares' },
  { value: 'ReadInvoices', description: 'Invoice totals and line items' },
  { value: 'ReadEmployeeNames', description: 'Personal data — only if your integration needs it', warning: true },
  { value: 'WriteBookRides', description: 'Create bookings on behalf of employees' },
]

/**
 * Create API key, then "Key created".
 *
 * Two screens in one dialog. The second shows the secret exactly once; closing it is
 * gated on a checkbox because "I copied it" is the one thing nobody can undo.
 */
export function CreateApiKeyDialog({
  open,
  onClose,
  onCreated,
  created,
  onDone,
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly onCreated: (result: ApiKeyCreated) => void
  readonly created: ApiKeyCreated | null
  readonly onDone: () => void
}) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [environment, setEnvironment] = useState<ApiKeyEnvironment>('Live')
  const [scopes, setScopes] = useState<readonly ApiKeyScope[]>(['ReadTrips', 'ReadInvoices'])
  const [stored, setStored] = useState(false)

  const create = useMutation({
    mutationFn: () => enterprise.apiKeys.create({ name: name.trim(), environment, scopes }),
    onSuccess: (result) => { reset(); onCreated(result) },
  })

  function reset() {
    setName(''); setEnvironment('Live'); setScopes(['ReadTrips', 'ReadInvoices']); setStored(false)
    create.reset()
  }

  function submit(event: SyntheticEvent) {
    event.preventDefault()
    create.mutate()
  }

  function toggleScope(scope: ApiKeyScope, on: boolean) {
    setScopes((current) => (on ? [...current, scope] : current.filter((s) => s !== scope)))
  }

  if (created !== null) {
    const key = created.key

    return (
      <Dialog
        open
        onClose={() => { if (stored) { setStored(false); onDone() } }}
        title="Key created"
        subtitle="Copy it now. We cannot show it again — you would have to rotate the key."
      >
        <div className="rounded-lg border border-line bg-surface-sunken p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-tertiary">Secret key</p>
          <p className="mt-1 break-all font-mono text-[14px] text-fg">{created.secret}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            variant="secondary"
            onClick={() => { void navigator.clipboard.writeText(created.secret).then(() => { toast.notify('Secret key copied') }) }}
          >
            Copy secret key
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              downloadText(
                `orbit-${key.environment.toLowerCase()}-${key.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.env`,
                `# Orbit for Business · ${key.name}\n# Created ${formatDate(key.createdAt)} by ${key.createdBy}. Keep this file out of source control.\nORBIT_API_KEY=${created.secret}\nORBIT_API_BASE_URL=https://api.orbit.ng\n`,
              )
            }}
          >
            Download .env snippet
          </Button>
        </div>

        <dl>
          <DefinitionRow label="Name" value={key.name} />
          <DefinitionRow label="Environment" value={key.environment === 'Live' ? 'Production — live money' : 'Sandbox — test data'} tone={key.environment === 'Live' ? 'warning' : 'neutral'} />
          <DefinitionRow label="Permissions" value={key.scopes.map((scope) => SCOPE_LABELS[scope]).join(', ')} />
          <DefinitionRow label="Created by" value={`${key.createdBy} · ${formatDate(key.createdAt)} ${formatTime(key.createdAt)}`} />
          <DefinitionRow label="Audit entry" value={`Recorded · hash ${created.auditHash}`} tone="success" mono />
        </dl>

        <Checkbox checked={stored} onChange={setStored} label="I have stored this key somewhere safe" />

        <div className="pt-2">
          <Button disabled={!stored} onClick={() => { setStored(false); onDone() }}>Done</Button>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog
      open={open}
      onClose={() => { reset(); onClose() }}
      title="Create API key"
      subtitle="Server-to-server access. Scope keys as narrowly as the integration allows."
    >
      <form id="create-api-key" onSubmit={submit} className="space-y-5">
        <Field label="Key name" htmlFor="key-name" hint="Shown in the audit log against every request">
          <TextInput id="key-name" required value={name} placeholder="Production · Xero sync" onChange={(event) => { setName(event.target.value); }} />
        </Field>

        <Field label="Environment">
          <RadioCards<ApiKeyEnvironment>
            label="Environment"
            value={environment}
            onChange={setEnvironment}
            columns={2}
            options={[
              { value: 'Live', label: 'Production', description: 'Live data and live money' },
              { value: 'Sandbox', label: 'Sandbox', description: 'Test data only' },
            ]}
          />
        </Field>

        <fieldset className="space-y-3">
          <legend className="mb-1 text-[13px] font-medium">Permissions</legend>
          {SCOPES.map((scope) => (
            <Checkbox
              key={scope.value}
              checked={scopes.includes(scope.value)}
              onChange={(on) => { toggleScope(scope.value, on); }}
              label={SCOPE_LABELS[scope.value]}
              description={scope.description}
              tone={scope.warning === true ? 'warning' : 'neutral'}
            />
          ))}
        </fieldset>

        <Banner tone="warning">The secret is shown once on the next screen and never again.</Banner>

        {create.error !== null && (
          <p role="alert" className="rounded-md bg-danger-subtle px-3 py-2 text-[13px] text-fg-danger">
            {create.error instanceof ApiError ? create.error.message : 'The key could not be created.'}
          </p>
        )}
      </form>

      <div className="flex items-center gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={() => { reset(); onClose() }}>Cancel</Button>
        <Button type="submit" form="create-api-key" loading={create.isPending} disabled={scopes.length === 0}>Create key</Button>
      </div>
    </Dialog>
  )
}
