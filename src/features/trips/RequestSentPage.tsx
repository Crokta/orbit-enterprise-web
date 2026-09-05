import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { Button } from '../../components/ui/Button'
import { DefinitionRow } from '../../components/ui/Card'
import { Icon } from '../../components/ui/Icon'
import { LoadError } from '../../components/ui/LoadError'
import { PageHeader } from '../../components/ui/PageHeader'
import { useToast } from '../../components/ui/Toast'
import { cn } from '../../components/ui/cn'
import { enterprise } from '../../lib/api/enterprise'
import { ApiError } from '../../lib/api/problem'
import { formatMoney, formatTime, formatWhen } from '../../lib/format'
import { queryKeys } from '../../lib/query/client'
import { useLastPathSegment } from '../../lib/router'
import { useMe } from '../session/useMe'

/**
 * Request sent: where an approval has got to, and what the approver sees.
 *
 * Polls while pending. The employee is usually looking at this on their phone, waiting
 * to leave, and a page that needs a reload to say "approved" is one they stop trusting.
 */
export function RequestSentPage() {
  const approvalId = useLastPathSegment()
  const me = useMe()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()

  const request = useQuery({
    queryKey: queryKeys.approvals.detail(approvalId),
    queryFn: () => enterprise.approvals.get(approvalId),
    refetchInterval: (query) => (query.state.data?.status === 'Pending' ? 10_000 : false),
  })

  const withdraw = useMutation({
    mutationFn: () => enterprise.approvals.withdraw(approvalId),
    onSuccess: () => {
      toast.notify('Request withdrawn. Nothing was booked.')
      void queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.myTrips })
    },
    onError: (error) => { toast.notify(error instanceof ApiError ? error.message : 'The request could not be withdrawn.', 'danger') },
  })

  const data = request.data
  const cap = me.data?.policy?.approvalThresholdMinor ?? null
  const overCap = data !== undefined && cap !== null ? Math.max(0, data.estimatedFareMinor - cap) : 0

  const heading =
    data === undefined
      ? 'Request'
      : data.status === 'Pending'
        ? 'Request sent'
        : data.status === 'Approved'
          ? 'Approved'
          : data.status === 'Declined'
            ? 'Declined'
            : data.status === 'Expired'
              ? 'Request expired'
              : 'Request withdrawn'

  return (
    <div className="space-y-6">
      <PageHeader title={heading} subtitle={data === undefined ? approvalId : `${approvalId} · ${data.pickupLabel} → ${data.dropoffLabel} · ${formatWhen(data.requestedAt)}`} />

      {request.isError ? (
        <LoadError error={request.error} what="this request" onRetry={() => { void request.refetch() }} />
      ) : data === undefined ? (
        <p className="text-[13px] text-fg-tertiary">Loading…</p>
      ) : (
        <div className="mx-auto max-w-[640px] space-y-4">
          <section className="rounded-xl border border-line-subtle bg-surface p-6 text-center shadow-[var(--shadow-e1)]">
            <span
              className={cn(
                'mx-auto grid size-14 place-items-center rounded-full',
                data.status === 'Pending' && 'bg-warning-subtle text-fg-warning',
                data.status === 'Approved' && 'bg-success-subtle text-fg-success',
                (data.status === 'Declined' || data.status === 'Expired') && 'bg-danger-subtle text-fg-danger',
                data.status === 'Withdrawn' && 'bg-subtle text-fg-tertiary',
              )}
            >
              <Icon name={data.status === 'Pending' ? 'clock' : data.status === 'Approved' ? 'check-circle' : 'warning'} size={26} />
            </span>

            <h2 className="mt-4 text-[22px] font-semibold">
              {data.status === 'Pending'
                ? 'Waiting on an approver'
                : data.status === 'Approved'
                  ? `Approved by ${data.decidedBy ?? 'your approver'}`
                  : data.status === 'Declined'
                    ? `Declined by ${data.decidedBy ?? 'your approver'}`
                    : data.status === 'Expired'
                      ? 'Nobody answered in time'
                      : 'You withdrew this request'}
            </h2>

            <p className="mx-auto mt-2 max-w-[460px] text-[14px] text-fg-secondary">
              {data.status === 'Pending'
                ? 'Your approvers have been notified. You will get an email and a push the moment someone decides.'
                : data.status === 'Approved'
                  ? 'Your ride is being booked and a driver assigned. Watch your phone for the driver details.'
                  : data.status === 'Declined'
                    ? (data.decisionNote ?? 'Nothing was charged and no driver was dispatched.')
                    : 'Nothing was booked. Book an under-cap ride instead at any time.'}
            </p>

            <ol className="relative mx-auto mt-6 max-w-[320px] space-y-5 border-l border-line-subtle pl-6 text-left">
              <Step state="done" title="Request sent" detail={`${formatTime(data.requestedAt)} · you`} />
              <Step
                state={data.status === 'Pending' ? 'current' : data.status === 'Approved' ? 'done' : 'failed'}
                title={data.status === 'Pending' ? 'Awaiting approval' : data.status === 'Approved' ? 'Approved' : data.status}
                detail={data.decidedAt === null ? `expires ${formatTime(data.expiresAt)}` : `${data.decidedBy ?? 'approver'} · ${formatTime(data.decidedAt)}`}
              />
              <Step
                state={data.rideId !== null ? 'done' : data.status === 'Approved' ? 'current' : 'later'}
                title="Ride booked"
                detail={data.rideId === null ? 'Driver assigned once approved' : data.rideId}
              />
            </ol>
          </section>

          <section className="rounded-xl border border-line-subtle bg-surface p-6 shadow-[var(--shadow-e1)]">
            <h3 className="mb-2 text-[16px] font-semibold">What the approver sees</h3>
            <dl>
              <DefinitionRow label="Fare estimate" value={formatMoney(data.estimatedFareMinor, data.currency)} mono />
              {cap !== null && <DefinitionRow label="Over cap by" value={overCap === 0 ? '—' : formatMoney(overCap, data.currency)} tone={overCap > 0 ? 'warning' : 'neutral'} mono />}
              <DefinitionRow label="Why it needs approval" value={data.policyReason} />
              <DefinitionRow label="Cost centre" value={data.costCentreCode ?? 'None'} />
              <DefinitionRow label="Requested" value={formatWhen(data.requestedAt)} />
            </dl>
          </section>

          <div className="flex items-center justify-center gap-3">
            {data.status === 'Pending' ? (
              <>
                <Button variant="secondary" loading={withdraw.isPending} onClick={() => { withdraw.mutate() }}>Withdraw request</Button>
                <Button variant="ghost" onClick={() => { void request.refetch() }}>Check again</Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => { void navigate({ to: '/my-trips' }) }}>My trips</Button>
                <Button onClick={() => { void navigate({ to: '/book' }) }}>Book another ride</Button>
              </>
            )}
          </div>

          {data.status === 'Pending' && (
            <p className="text-center text-[12px] text-fg-tertiary">
              If nobody has replied by {formatTime(data.expiresAt)} the request expires and nothing is booked. Book an under-cap ride instead at any time.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Step({ state, title, detail }: { readonly state: 'done' | 'current' | 'failed' | 'later'; readonly title: string; readonly detail: string }) {
  return (
    <li className="relative">
      <span
        aria-hidden="true"
        className={cn(
          'absolute -left-[31px] top-0.5 grid size-[18px] place-items-center rounded-full border-2 bg-surface',
          state === 'done' && 'border-[var(--bg-success)] bg-success',
          state === 'current' && 'border-[var(--bg-brand)] bg-brand',
          state === 'failed' && 'border-[var(--bg-danger)] bg-danger',
          state === 'later' && 'border-line-strong',
        )}
      >
        {state === 'done' && <Icon name="check" size={10} className="text-white" />}
      </span>
      <p className={cn('text-[14px] font-medium', state === 'later' ? 'text-fg-tertiary' : 'text-fg')}>{title}</p>
      <p className="font-mono text-[11px] text-fg-tertiary">{detail}</p>
    </li>
  )
}
