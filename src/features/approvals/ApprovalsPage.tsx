import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '../../components/ui/Button'
import { Money } from '../../components/ui/Money'
import { api } from '../../lib/api/client'
import { ApiError } from '../../lib/api/problem'
import { queryKeys } from '../../lib/query/client'

interface ApprovalRow {
  readonly requestId: string
  readonly employeeName: string
  readonly pickupLabel: string
  readonly dropoffLabel: string
  readonly fareMinor: number
  readonly currency: string
  readonly reason: string
  readonly requestedAt: string
  readonly costCentre: string
}

/** Trips waiting on a manager's decision. */
export function ApprovalsPage() {
  const queryClient = useQueryClient()

  const { data, isPending } = useQuery({
    queryKey: queryKeys.approvals.queue(),
    queryFn: () => api.get<readonly ApprovalRow[]>('/v1/enterprise/approvals'),

    // An employee is standing on a pavement waiting for this decision, so the queue
    // refreshes on its own rather than waiting for the manager to reload.
    refetchInterval: 30_000,
  })

  const decide = useMutation({
    mutationFn: ({ requestId, approve }: { requestId: string; approve: boolean }) =>
      api.post(`/v1/enterprise/approvals/${requestId}/decide`, { json: { approve } }),

    onSettled: () => {
      // Invalidated whether it succeeded or failed. On failure the row may have been
      // decided by someone else, and leaving it on screen invites a second attempt at
      // something already done.
      void queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all })
    },
  })

  if (isPending) {
    return <p className="text-[13px] text-fg-secondary">Loading approvals…</p>
  }

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-[28px] font-semibold leading-[34px]">Approvals</h1>

      {data?.length === 0 ? (
        <p className="rounded-lg border border-line-subtle bg-surface p-8 text-center text-[13px] text-fg-tertiary">
          Nothing is waiting on you.
        </p>
      ) : null}

      {data?.map((row) => (
        <article key={row.requestId} className="rounded-lg border border-line-subtle bg-surface p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[15px] font-medium">{row.employeeName}</p>
              <p className="truncate text-[13px] text-fg-secondary">
                {row.pickupLabel} → {row.dropoffLabel}
              </p>
              <p className="mt-1 text-[13px] text-fg-warning">{row.reason}</p>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-fg-tertiary">{row.costCentre}</p>
            </div>

            <Money minorUnits={row.fareMinor} currency={row.currency} className="text-[17px] font-medium" />
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                decide.mutate({ requestId: row.requestId, approve: false })
              }}
            >
              Decline
            </Button>

            <Button
              size="sm"
              onClick={() => {
                decide.mutate({ requestId: row.requestId, approve: true })
              }}
            >
              Approve
            </Button>
          </div>
        </article>
      ))}

      {decide.error !== null ? (
        <p role="alert" className="rounded-md bg-danger-subtle px-4 py-3 text-[13px] text-fg-danger">
          {decide.error instanceof ApiError && decide.error.status === 409
            ? 'Someone else has already decided that request.'
            : 'The decision could not be recorded. Please try again.'}
        </p>
      ) : null}
    </div>
  )
}
