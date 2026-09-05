import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { PrefixedInput, SearchInput, TextInput, Toggle } from '../../components/ui/Inputs'
import { ExportButton, FilterSelect, ListToolbar, Pagination } from '../../components/ui/ListControls'
import { LoadError } from '../../components/ui/LoadError'
import { PageHeader } from '../../components/ui/PageHeader'
import { useToast } from '../../components/ui/Toast'
import { cn } from '../../components/ui/cn'
import { enterprise, type Policy, type PolicyRules, vehicleLabel } from '../../lib/api/enterprise'
import { ApiError } from '../../lib/api/problem'
import { formatCount } from '../../lib/format'
import { useDebounced, usePagedList } from '../../lib/paging'
import { queryKeys } from '../../lib/query/client'
import { NewPolicyDialog } from './NewPolicyDialog'

/** The vehicle classes the platform prices for corporate accounts. */
export const CLASSES = ['Economy', 'Comfort', 'Xl'] as const

/**
 * Ride policies: a list on the left, the selected policy's rules on the right.
 *
 * Every rule is a switch with its value beside it, and nothing saves until "Save policy".
 * A rule that took effect on toggle would send someone's ride for approval mid-edit.
 */
export function PoliciesPage() {
  const queryClient = useQueryClient()
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [active, setActive] = useState<'all' | 'active' | 'retired'>('all')
  const q = useDebounced(query.trim())
  const params = useMemo(
    () => ({ q: q.length === 0 ? undefined : q, active: active === 'all' ? undefined : active === 'active' }),
    [q, active],
  )

  const policies = usePagedList<Policy, typeof params>({
    key: queryKeys.policies.all,
    filters: params,
    fetchPage: (page) => enterprise.policies.list(page),
    initialLimit: 25,
  })

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // The new-policy dialog assigns people; bounded by the company, fetched when opened.
  const employees = useQuery({
    queryKey: queryKeys.employees.list({ forDialog: 'policies' }),
    queryFn: () => enterprise.employees.list({ status: 'Active', limit: 200 }),
    enabled: creating,
  })

  const sorted = useMemo(
    () => [...policies.items].sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.activeEmployees - a.activeEmployees),
    [policies.items],
  )

  const selected = sorted.find((policy) => policy.policyId === selectedId) ?? sorted[0]

  useEffect(() => {
    if (selected !== undefined && selectedId !== selected.policyId) {
      setSelectedId(selected.policyId)
    }
  }, [selected, selectedId])

  const covered = sorted.reduce((sum, policy) => sum + policy.activeEmployees, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ride policies"
        subtitle={policies.query.data === undefined ? undefined : `${formatCount(sorted.length)}${policies.hasNext ? '+' : ''} policies · applied to ${formatCount(covered)} employees`}
        actions={
          <>
            <ExportButton path={enterprise.policies.exportPath} query={params} filename="orbit-policies.csv" />
            <Button onClick={() => { setCreating(true); }}>New policy</Button>
          </>
        }
      />

      <ListToolbar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search policies" className="w-[280px]" />
        <FilterSelect
          label="Status"
          value={active}
          onChange={setActive}
          options={[
            { value: 'all', label: 'Active and retired' },
            { value: 'active', label: 'Active' },
            { value: 'retired', label: 'Retired' },
          ]}
        />
      </ListToolbar>

      {policies.query.isError ? (
        <LoadError error={policies.query.error} what="the policies" onRetry={() => { void policies.query.refetch() }} />
      ) : policies.query.isPending ? (
        <p className="text-[13px] text-fg-tertiary">Loading policies…</p>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-line-subtle bg-surface p-12 text-center">
          <p className="text-[15px] font-medium">{q.length > 0 || active !== 'all' ? 'No policies match' : 'No policies yet'}</p>
          <p className="mt-1 text-[13px] text-fg-tertiary">
            {q.length > 0 || active !== 'all' ? 'Try another search or filter.' : 'Without one, every trip is allowed and nothing needs approval.'}
          </p>
          {q.length === 0 && active === 'all' && <Button className="mt-4" onClick={() => { setCreating(true); }}>Create the first policy</Button>}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-2">
          <ul className="space-y-2" aria-label="Policies">
            {sorted.map((policy) => {
              const active = policy.policyId === selected?.policyId

              return (
                <li key={policy.policyId}>
                  <button
                    type="button"
                    onClick={() => { setSelectedId(policy.policyId); }}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-start justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                      active ? 'border-line-brand bg-brand-subtle' : 'border-line-subtle bg-surface hover:bg-hover',
                    )}
                  >
                    <span>
                      <span className={cn('block text-[16px] font-medium leading-6', active ? 'text-fg-brand' : 'text-fg')}>{policy.name}</span>
                      <span className="block text-[12px] text-fg-tertiary">{formatCount(policy.activeEmployees)} employees</span>
                    </span>
                    <Badge tone={policy.isActive ? 'success' : 'neutral'}>{policy.isActive ? 'Active' : 'Retired'}</Badge>
                  </button>
                </li>
              )
            })}
          </ul>
          <Pagination list={policies} />
          </div>

          {selected !== undefined && (
            <PolicyEditor
              key={selected.policyId}
              policy={selected}
              onSaved={(saved) => {
                toast.notify(`${saved.name} saved`)
                void queryClient.invalidateQueries({ queryKey: queryKeys.policies.all })
                void queryClient.invalidateQueries({ queryKey: queryKeys.me })
              }}
            />
          )}
        </div>
      )}

      <NewPolicyDialog
        open={creating}
        onClose={() => { setCreating(false); }}
        existing={sorted}
        employees={employees.data?.items ?? []}
        onCreated={(policy) => {
          setCreating(false)
          setSelectedId(policy.policyId)
          toast.notify(`${policy.name} created`)
          void queryClient.invalidateQueries({ queryKey: queryKeys.policies.all })
        }}
      />
    </div>
  )
}

interface Draft {
  readonly capOn: boolean
  readonly cap: string
  readonly hardCapOn: boolean
  readonly hardCap: string
  readonly hoursOn: boolean
  readonly from: string
  readonly to: string
  readonly tiersOn: boolean
  readonly tiers: readonly string[]
  readonly costCentre: boolean
  readonly surge: boolean
  readonly isActive: boolean
}

function draftOf(policy: Policy): Draft {
  return {
    capOn: policy.approvalThresholdMinor !== null,
    cap: policy.approvalThresholdMinor === null ? '10000' : String(policy.approvalThresholdMinor / 100),
    hardCapOn: policy.hardCapMinor !== null,
    hardCap: policy.hardCapMinor === null ? '' : String(policy.hardCapMinor / 100),
    hoursOn: policy.permittedFrom !== null,
    from: policy.permittedFrom ?? '07:00',
    to: policy.permittedTo ?? '20:00',
    tiersOn: policy.allowedClasses.length > 0,
    tiers: policy.allowedClasses.length > 0 ? policy.allowedClasses : ['Economy', 'Comfort'],
    costCentre: policy.requiresCostCentre,
    surge: policy.requiresApprovalForSurge,
    isActive: policy.isActive,
  }
}

/** Turns the editor state into the rules the service accepts. */
export function rulesOf(name: string, currency: string, draft: Draft): PolicyRules {
  return {
    name,
    currency,
    approvalThresholdMinor: draft.capOn ? toMinor(draft.cap) : null,
    hardCapMinor: draft.hardCapOn ? toMinor(draft.hardCap) : null,
    allowedClasses: draft.tiersOn ? draft.tiers : [],
    permittedFrom: draft.hoursOn ? draft.from : null,
    permittedTo: draft.hoursOn ? draft.to : null,
    requiresCostCentre: draft.costCentre,
    requiresApprovalForSurge: draft.surge,
  }
}

export function toMinor(major: string): number | null {
  const value = Number(major.replace(/[^\d.]/g, ''))
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null
}

function PolicyEditor({ policy, onSaved }: { readonly policy: Policy; readonly onSaved: (policy: Policy) => void }) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(policy))
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftOf(policy))

  const save = useMutation({
    mutationFn: () => enterprise.policies.update(policy.policyId, rulesOf(policy.name, policy.currency, draft), draft.isActive),
    onSuccess: onSaved,
  })

  function patch(changes: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...changes }))
  }

  const cap = toMinor(draft.cap)
  const hardCap = toMinor(draft.hardCap)
  const capAboveLimit = draft.capOn && draft.hardCapOn && cap !== null && hardCap !== null && cap > hardCap
  const invalid = (draft.capOn && cap === null) || (draft.hardCapOn && hardCap === null) || capAboveLimit || (draft.tiersOn && draft.tiers.length === 0)

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-line-subtle bg-surface shadow-[var(--shadow-e1)]">
        <header className="flex items-start justify-between gap-4 border-b border-line-subtle px-4 py-4">
          <div>
            <h2 className="text-[16px] font-semibold">{policy.name} policy</h2>
            <p className="text-[12px] text-fg-tertiary">Applies to {formatCount(policy.activeEmployees)} employees</p>
          </div>
          <Badge tone={draft.isActive ? 'success' : 'neutral'}>{draft.isActive ? 'Active' : 'Retired'}</Badge>
        </header>

        <div className="divide-y divide-line-subtle px-4">
          <Toggle
            checked={draft.capOn}
            onChange={(on) => { patch({ capOn: on }); }}
            label="Per-ride spend cap"
            description="Rides above this need approval before booking"
            trailing={
              draft.capOn ? (
                <PrefixedInput
                  prefix="₦"
                  inputMode="numeric"
                  aria-label="Per-ride cap"
                  value={draft.cap}
                  onChange={(event) => { patch({ cap: event.target.value }); }}
                  className="w-[200px]"
                />
              ) : undefined
            }
          />

          <Toggle
            checked={draft.hardCapOn}
            onChange={(on) => { patch({ hardCapOn: on }); }}
            label="Hard limit"
            description="Rides above this cannot be booked at all, even with approval"
            trailing={
              draft.hardCapOn ? (
                <PrefixedInput
                  prefix="₦"
                  inputMode="numeric"
                  aria-label="Hard limit"
                  value={draft.hardCap}
                  onChange={(event) => { patch({ hardCap: event.target.value }); }}
                  className="w-[200px]"
                />
              ) : undefined
            }
          />

          <Toggle
            checked={draft.hoursOn}
            onChange={(on) => { patch({ hoursOn: on }); }}
            label="Allowed hours"
            description="Bookings outside these hours are flagged for approval"
            trailing={
              draft.hoursOn ? (
                <div className="flex items-center gap-2">
                  <TextInput type="time" aria-label="Allowed from" value={draft.from} onChange={(event) => { patch({ from: event.target.value }); }} className="w-[120px]" />
                  <span className="text-fg-tertiary">–</span>
                  <TextInput type="time" aria-label="Allowed to" value={draft.to} onChange={(event) => { patch({ to: event.target.value }); }} className="w-[120px]" />
                </div>
              ) : undefined
            }
          />

          <Toggle
            checked={draft.tiersOn}
            onChange={(on) => { patch({ tiersOn: on }); }}
            label="Ride tiers allowed"
            description={
              draft.tiersOn
                ? `${draft.tiers.map(vehicleLabel).join(' and ') || 'Nothing'}. Other tiers cannot be booked`
                : 'Every tier can be booked'
            }
            trailing={
              draft.tiersOn ? (
                <div className="flex gap-1.5" role="group" aria-label="Ride tiers">
                  {CLASSES.map((tier) => {
                    const on = draft.tiers.includes(tier)
                    return (
                      <button
                        key={tier}
                        type="button"
                        aria-pressed={on}
                        onClick={() => { patch({ tiers: on ? draft.tiers.filter((t) => t !== tier) : [...draft.tiers, tier] }); }}
                        className={cn(
                          'h-8 rounded-full border px-3 text-[12px] font-medium transition-colors',
                          on ? 'border-line-brand bg-brand-subtle text-fg-brand' : 'border-line text-fg-secondary hover:bg-hover',
                        )}
                      >
                        {vehicleLabel(tier)}
                      </button>
                    )
                  })}
                </div>
              ) : undefined
            }
          />

          <Toggle
            checked={draft.costCentre}
            onChange={(on) => { patch({ costCentre: on }); }}
            label="Cost centre required"
            description="A booking without a cost centre goes for approval"
          />

          <Toggle
            checked={draft.surge}
            onChange={(on) => { patch({ surge: on }); }}
            label="Surge needs approval"
            description="Any surge multiplier sends the ride for approval regardless of fare"
          />

          <Toggle
            checked={draft.isActive}
            onChange={(on) => { patch({ isActive: on }); }}
            label="Policy in force"
            description="Retired policies are kept for the trips booked under them; employees fall back to the company default"
          />
        </div>
      </section>

      {save.error !== null && (
        <p role="alert" className="rounded-md bg-danger-subtle px-3 py-2 text-[13px] text-fg-danger">
          {save.error instanceof ApiError ? save.error.message : 'The policy could not be saved.'}
        </p>
      )}

      {capAboveLimit && (
        <p role="alert" className="rounded-md bg-warning-subtle px-3 py-2 text-[13px] text-fg-warning">
          The approval cap is above the hard limit, so it could never be reached.
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="ghost" disabled={!dirty} onClick={() => { setDraft(draftOf(policy)); }}>Discard changes</Button>
        <Button disabled={!dirty || invalid} loading={save.isPending} onClick={() => { save.mutate() }}>Save policy</Button>
      </div>
    </div>
  )
}
