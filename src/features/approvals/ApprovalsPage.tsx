import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Icon } from '../../components/ui/Icon'
import { Field, SearchInput } from '../../components/ui/Inputs'
import { ExportButton, FilterSelect, ListToolbar, Pagination } from '../../components/ui/ListControls'
import { LoadError } from '../../components/ui/LoadError'
import { Money } from '../../components/ui/Money'
import { PageHeader } from '../../components/ui/PageHeader'
import { useToast } from '../../components/ui/Toast'
import { cn } from '../../components/ui/cn'
import { canManageTravel, enterprise, type Approval } from '../../lib/api/enterprise'
import { ApiError } from '../../lib/api/problem'
import { formatCount, formatMoney, formatUntil, formatWaiting, formatWhen } from '../../lib/format'
import { useDebounced, usePagedList } from '../../lib/paging'
import { queryKeys } from '../../lib/query/client'
import { useMe } from '../session/useMe'

/** Trips waiting on a manager's decision. */
export function ApprovalsPage() {
  const me = useMe()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [declining, setDeclining] = useState<Approval | null>(null)

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'pending' | 'decided' | 'all'>('pending')
  const q = useDebounced(query.trim())
  const params = useMemo(() => ({ q: q.length === 0 ? undefined : q, status }), [q, status])

  const queue = usePagedList<Approval, typeof params>({
    key: queryKeys.approvals.all,
    filters: params,
    fetchPage: (page) => enterprise.approvals.queue(page),
    initialLimit: 25,

    // An employee is standing on a pavement waiting for this decision, so the queue
    // refreshes on its own rather than waiting for the manager to reload.
    refetchInterval: 30_000,
  })

  const decide = useMutation({
    mutationFn: ({ approval, approve, note }: { approval: Approval; approve: boolean; note: string | null }) =>
      enterprise.approvals.decide(approval.approvalId, approve, note),
    onSuccess: (result) => {
      toast.notify(result.status === 'Approved' ? `Approved ${result.employeeName}'s ride` : `Declined ${result.employeeName}'s ride`)
    },
    onError: (error) => {
      toast.notify(
        error instanceof ApiError && error.status === 409
          ? 'Someone else has already decided that request.'
          : error instanceof ApiError && error.code === 'trip_approval.self_approval'
            ? 'You cannot approve your own trip.'
            : 'The decision could not be recorded. Please try again.',
        'danger',
      )
    },
    onSettled: () => {
      // Invalidated whether it succeeded or failed. On failure the row may have been
      // decided by someone else, and leaving it on screen invites a second attempt at
      // something already done.
      void queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
    },
  })

  const rows = queue.items
  const oldest = rows[0]
  const policyCap = me.data?.policy?.approvalThresholdMinor ?? null
  const currency = me.data?.currency ?? 'NGN'

  return (
    <div className="space-y-5">
      <PageHeader
        title="Approvals"
        subtitle={
          queue.query.data === undefined
            ? undefined
            : status !== 'pending'
              ? `${formatCount(rows.length)}${queue.hasNext ? '+' : ''} requests`
              : rows.length === 0
                ? 'Nothing pending'
                : `${formatCount(rows.length)}${queue.hasNext ? '+' : ''} pending · oldest waiting ${oldest === undefined ? '' : formatWaiting(oldest.requestedAt)}`
        }
        actions={
          <>
            <ExportButton path={enterprise.approvals.exportPath} query={params} filename="orbit-approvals.csv" />
            {me.data !== undefined && canManageTravel(me.data.role) && (
              <Button onClick={() => { void navigate({ to: '/policies' }) }}>Approval settings</Button>
            )}
          </>
        }
      />

      <Banner tone="info">
        Four-eyes approval is on: you cannot approve a ride you requested
        {policyCap === null ? '.' : `, and rides over ${formatMoney(policyCap, currency)} come here for a decision.`}
        {' '}Requests expire after 15 minutes if nobody answers.
      </Banner>

      <ListToolbar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search employee, route or reason" className="w-[300px]" />
        <FilterSelect
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'decided', label: 'Decided' },
            { value: 'all', label: 'All requests' },
          ]}
        />
      </ListToolbar>

      {queue.query.isError ? (
        <LoadError error={queue.query.error} what="the approval queue" onRetry={() => { void queue.query.refetch() }} />
      ) : queue.query.isPending ? (
        <p className="text-[13px] text-fg-tertiary">Loading approvals…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-line-subtle bg-surface p-12 text-center">
          <Icon name="check-circle" size={28} className="mx-auto text-fg-success" />
          <p className="mt-3 text-[15px] font-medium">{q.length > 0 || status !== 'pending' ? 'No requests match' : 'Nothing is waiting on you'}</p>
          <p className="mt-1 text-[13px] text-fg-tertiary">
            {q.length > 0 || status !== 'pending' ? 'Try another search or status.' : 'New requests appear here the moment an employee books outside policy.'}
          </p>
        </div>
      ) : (
        rows.map((row) => {
          const mine = row.employeeId === me.data?.employeeId
          const busy = decide.isPending && decide.variables.approval.approvalId === row.approvalId
          const severe = row.policyReason.toLowerCase().includes('limit') && row.estimatedFareMinor >= 5_000_000

          return (
            <article
              key={row.approvalId}
              className={cn(
                'rounded-xl border bg-surface p-4 shadow-[var(--shadow-e1)]',
                severe ? 'border-[color:var(--border-danger)]/60' : 'border-line-subtle',
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar name={row.employeeName} size="lg" />
                  <div>
                    <p className="text-[16px] font-semibold leading-6">{row.employeeName}</p>
                    <p className="text-[12px] text-fg-tertiary">
                      {[row.costCentreCode, row.employeeEmail].filter((part) => part !== null && part.length > 0).join(' · ')}
                    </p>
                  </div>
                </div>
                <p className="inline-flex items-center gap-1.5 font-mono text-[12px] text-fg-tertiary tabular">
                  <Icon name="clock" size={14} />
                  waiting {formatWaiting(row.requestedAt)}
                </p>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-tertiary">Route</p>
                  <p className="mt-1 text-[15px]">
                    {row.pickupLabel} <span className="text-fg-tertiary">→</span> {row.dropoffLabel}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-tertiary">Requested</p>
                  <p className="mt-1 text-[15px]">{formatWhen(row.requestedAt)} · expires {formatUntil(row.expiresAt)}</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-tertiary">Fare</p>
                  <Money minorUnits={row.estimatedFareMinor} currency={row.currency} className="mt-1 block text-[15px] font-semibold" />
                </div>
              </div>

              <div className={cn('mt-4 flex items-start gap-3 rounded-lg px-4 py-3', severe ? 'bg-danger-subtle text-fg-danger' : 'bg-warning-subtle text-fg-warning')}>
                <Icon name="warning" size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-[14px] font-semibold">{row.policyReason}</p>
                  {row.decisionNote !== null && <p className="text-[12px] opacity-90">“{row.decisionNote}”</p>}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                {mine && <Badge tone="danger">Your own request</Badge>}
                {severe && <Badge tone="danger">Over ₦50,000</Badge>}
                {row.status !== 'Pending' && <Badge tone={row.status === 'Approved' ? 'success' : 'neutral'}>{row.status}{row.decidedBy === null ? '' : ` by ${row.decidedBy}`}</Badge>}
                {row.status === 'Pending' && (
                  <div className="ml-auto flex gap-2">
                    <Button variant="secondary" disabled={mine || busy} onClick={() => { setDeclining(row); }}>
                      Decline
                    </Button>
                    <Button loading={busy} disabled={mine} onClick={() => { decide.mutate({ approval: row, approve: true, note: null }) }}>
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            </article>
          )
        })
      )}

      {!queue.query.isPending && !queue.query.isError && <Pagination list={queue} />}

      <DeclineDialog
        approval={declining}
        loading={decide.isPending}
        onClose={() => { setDeclining(null); }}
        onDecline={(note) => {
          if (declining !== null) {
            decide.mutate({ approval: declining, approve: false, note })
            setDeclining(null)
          }
        }}
      />
    </div>
  )
}

/** Declining asks for a word of explanation: the employee reads it on their phone. */
function DeclineDialog({
  approval,
  loading,
  onClose,
  onDecline,
}: {
  readonly approval: Approval | null
  readonly loading: boolean
  readonly onClose: () => void
  readonly onDecline: (note: string | null) => void
}) {
  const [note, setNote] = useState('')

  return (
    <Dialog
      open={approval !== null}
      onClose={() => { setNote(''); onClose() }}
      title="Decline this ride?"
      subtitle={approval === null ? undefined : `${approval.employeeName} will be told straight away. Nothing is charged and no driver is dispatched.`}
    >
      <Field label="Reason (optional)" htmlFor="decline-note" hint="Shown to the employee, e.g. “Use Orbit Comfort instead” or “Book after 19:00”.">
        <textarea
          id="decline-note"
          value={note}
          rows={3}
          maxLength={500}
          onChange={(event) => { setNote(event.target.value); }}
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-[15px] text-fg focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-[color:var(--border-focus)]/30"
        />
      </Field>
      <div className="flex items-center gap-3 pt-2">
        <Button variant="ghost" onClick={() => { setNote(''); onClose() }}>Cancel</Button>
        <Button variant="danger" loading={loading} onClick={() => { onDecline(note.trim() === '' ? null : note.trim()); setNote('') }}>
          Decline ride
        </Button>
      </div>
    </Dialog>
  )
}
