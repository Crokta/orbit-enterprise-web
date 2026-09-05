import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { Card, DefinitionRow } from '../../components/ui/Card'
import { Icon } from '../../components/ui/Icon'
import { Money } from '../../components/ui/Money'
import { PageHeader } from '../../components/ui/PageHeader'
import { useToast } from '../../components/ui/Toast'
import { cn } from '../../components/ui/cn'
import { type QuoteOption, enterprise } from '../../lib/api/enterprise'
import { newIdempotencyKey } from '../../lib/api/client'
import { ApiError } from '../../lib/api/problem'
import { formatMoney } from '../../lib/format'
import { queryKeys } from '../../lib/query/client'
import { useMe } from '../session/useMe'
import { clearDraft, loadDraft } from './draft'

/**
 * Choose a ride: every priced option with the policy's verdict on it.
 *
 * An option the policy forbids is shown but not selectable, with the reason; an option
 * that needs approval says so before anyone commits. The primary button changes with the
 * selection — "Book" or "Request approval" — so nobody is surprised afterwards.
 */
export function ChooseRidePage() {
  const me = useMe()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const draft = useMemo(loadDraft, [])

  const [selectedClass, setSelectedClass] = useState<string | null>(() => {
    const first = draft?.options.find((option) => option.policy.allowed)
    return first?.vehicleClass ?? null
  })

  // One key per intent, generated when the page opens rather than on each click. A
  // retry after a timeout the client never saw the answer to sends the same key and gets
  // the same ride rather than a second one.
  const [idempotencyKey] = useState(newIdempotencyKey)

  const selected = draft?.options.find((option) => option.vehicleClass === selectedClass) ?? null

  const book = useMutation({
    mutationFn: (option: QuoteOption) => {
      if (draft === null) {
        throw new Error('No booking in progress')
      }

      return enterprise.booking.book(
        {
          quoteToken: option.quoteToken,
          vehicleClass: option.vehicleClass,
          estimatedFareMinor: option.totalMinor,
          currency: option.currency,
          surgeMultiplier: option.surgeMultiplier,
          pickupLabel: draft.pickup.name,
          dropoffLabel: draft.dropoff.name,
          costCentre: draft.costCentre,
        },
        idempotencyKey,
      )
    },
    onSuccess: (result) => {
      clearDraft()
      void queryClient.invalidateQueries({ queryKey: queryKeys.myTrips })
      void queryClient.invalidateQueries({ queryKey: queryKeys.me })

      if (result.status === 'AwaitingApproval' && result.approvalId !== null) {
        void navigate({ to: '/my-trips/$approvalId', params: { approvalId: result.approvalId } })
      } else {
        toast.notify('Booked. Your driver is being found now.')
        void navigate({ to: '/my-trips' })
      }
    },
  })

  if (draft === null || draft.options.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Choose a ride" />
        <Banner tone="info" action={<Button onClick={() => { void navigate({ to: '/book' }) }}>Start a booking</Button>}>
          There is no trip to price yet. Enter a pick-up and destination first.
        </Banner>
      </div>
    )
  }

  const policy = me.data?.policy ?? null
  const cap = policy?.approvalThresholdMinor ?? null
  const cheapestAllowed = draft.options.filter((option) => option.policy.allowed).sort((a, b) => a.totalMinor - b.totalMinor)[0]
  const allOverCap = draft.options.every((option) => cap !== null && option.totalMinor > cap)
  const surge = Math.max(...draft.options.map((option) => option.surgeMultiplier))
  const approver = 'your approver'
  const overCapBy = selected !== null && cap !== null ? Math.max(0, selected.totalMinor - cap) : 0

  return (
    <div className="space-y-5">
      <PageHeader
        title="Choose a ride"
        subtitle={`${draft.pickup.name} → ${draft.dropoff.name} · ${draft.date} ${draft.time}${draft.costCentre === null ? '' : ` · ${draft.costCentre}`}`}
      />

      {allOverCap && cap !== null && (
        <Banner tone="warning" title={`Every option today is above your ${formatMoney(cap, policy?.currency ?? 'NGN')} cap`}>
          {surge > 1 ? `Surge is ${surge.toFixed(1)}× at the pick-up. ` : ''}Booking now needs approval from {approver}. You can also wait for surge to drop, or travel outside peak.
        </Banner>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
        <div className="space-y-4">
          <Card title="Available now" subtitle={surge > 1 ? `Prices include ${surge.toFixed(1)}× surge` : 'Prices are fixed for this quote'}>
            <ul className="space-y-3" role="radiogroup" aria-label="Ride options">
              {draft.options.map((option) => {
                const active = option.vehicleClass === selectedClass
                const base = option.surgeMultiplier > 1 ? Math.round(option.totalMinor / option.surgeMultiplier) : null

                return (
                  <li key={option.vehicleClass}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={!option.policy.allowed}
                      onClick={() => { setSelectedClass(option.vehicleClass); }}
                      className={cn(
                        'flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors',
                        active ? 'border-line-brand bg-brand-subtle' : 'border-line-subtle bg-surface hover:bg-hover',
                        'disabled:cursor-not-allowed disabled:opacity-60',
                      )}
                    >
                      <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg', active ? 'bg-brand text-fg-on-brand' : 'bg-subtle text-fg-secondary')}>
                        <Icon name="car" size={22} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-[16px] font-semibold', active ? 'text-fg-brand' : 'text-fg')}>{option.label}</span>
                        <span className="block text-[12px] text-fg-tertiary">
                          {seats(option.vehicleClass)} · {Math.max(1, Math.round(option.etaSeconds / 60))} min away
                        </span>
                      </span>
                      <span className="text-right">
                        <Money minorUnits={option.totalMinor} currency={option.currency} className="block text-[18px] font-semibold" />
                        {base !== null && <span className="block font-mono text-[11px] text-fg-tertiary line-through">{formatMoney(base, option.currency)}</span>}
                      </span>
                    </button>

                    {(option.policy.requiresApproval || !option.policy.allowed) && (
                      <p className={cn('mt-1.5 flex items-center gap-1.5 px-1 text-[12px]', option.policy.allowed ? 'text-fg-warning' : 'text-fg-danger')}>
                        <Icon name="warning" size={14} />
                        {option.policy.allowed ? 'Needs approval' : 'Not available'}
                        {option.policy.reason !== null ? ` · ${option.policy.reason}` : ''}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>

          {selected !== null && selected.policy.requiresApproval && cheapestAllowed !== undefined && (
            <Card title="Cheaper alternatives" subtitle="Suggested because your ride needs approval">
              <ul className="divide-y divide-line-subtle">
                {surge > 1 && (
                  <li className="flex items-center justify-between py-3">
                    <span>
                      <span className="block text-[14px] font-medium">Travel later</span>
                      <span className="block text-[12px] text-fg-tertiary">Surge usually clears within the hour</span>
                    </span>
                    <span className="font-mono text-[12px] text-fg-success">saves up to {formatMoney(selected.totalMinor - Math.round(selected.totalMinor / surge), selected.currency)}</span>
                  </li>
                )}
                {cheapestAllowed.vehicleClass !== selected.vehicleClass && cheapestAllowed.totalMinor < selected.totalMinor && (
                  <li className="flex items-center justify-between py-3">
                    <span>
                      <span className="block text-[14px] font-medium">Take {cheapestAllowed.label}</span>
                      <span className="block text-[12px] text-fg-tertiary">{cheapestAllowed.policy.requiresApproval ? 'Still needs approval' : 'Books immediately'}</span>
                    </span>
                    <span className="font-mono text-[12px] text-fg-success">saves {formatMoney(selected.totalMinor - cheapestAllowed.totalMinor, selected.currency)}</span>
                  </li>
                )}
                <li className="flex items-center justify-between py-3">
                  <span>
                    <span className="block text-[14px] font-medium">Change the pick-up</span>
                    <span className="block text-[12px] text-fg-tertiary">A short walk out of the surge cell often halves the fare</span>
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => { void navigate({ to: '/book' }) }}>Change trip</Button>
                </li>
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card title="What happens next" subtitle={selected?.policy.requiresApproval === true ? 'Because this ride needs approval' : 'Within policy'}>
            <ol className="relative space-y-5 border-l border-line-subtle pl-6">
              <Step state="done" title="You choose" detail={selected === null ? 'Pick an option' : `${formatMoney(selected.totalMinor, selected.currency)} · ${selected.label}`} />
              {selected?.policy.requiresApproval === true ? (
                <>
                  <Step state="next" title={`${capitalise(approver)} decides`} detail="Requests expire after 15 minutes" />
                  <Step state="later" title="Ride is booked" detail="Driver assigned once approved" />
                </>
              ) : (
                <Step state="next" title="Ride is booked" detail="A driver is assigned straight away" />
              )}
            </ol>
            {selected?.policy.requiresApproval === true && (
              <p className="mt-4 text-[12px] text-fg-tertiary">If it is declined, nothing is charged and no driver is dispatched.</p>
            )}
          </Card>

          <Card title="Summary">
            <dl>
              <DefinitionRow label="Fare estimate" value={selected === null ? '—' : formatMoney(selected.totalMinor, selected.currency)} mono />
              {cap !== null && <DefinitionRow label="Over cap by" value={overCapBy === 0 ? '—' : formatMoney(overCapBy, selected?.currency ?? 'NGN')} tone={overCapBy > 0 ? 'warning' : 'neutral'} mono />}
              <DefinitionRow label="Cost centre" value={draft.costCentre ?? 'None'} />
              {draft.projectCode.length > 0 && <DefinitionRow label="Project" value={draft.projectCode} />}
              <DefinitionRow label="Billed to" value={me.data?.company.name ?? '—'} />
              {draft.bookingFor !== 'me' && <DefinitionRow label="Passenger" value={draft.passenger} />}
            </dl>
          </Card>
        </div>
      </div>

      {book.error !== null && (
        <p role="alert" className="rounded-md bg-danger-subtle px-4 py-3 text-[13px] text-fg-danger">
          {book.error instanceof ApiError
            ? book.error.code === 'pricing.quote_expired'
              ? 'That price is no longer current. Go back and check the fare again.'
              : book.error.message
            : 'The ride could not be booked. Nothing has been charged.'}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button variant="ghost" onClick={() => { void navigate({ to: '/book' }) }}>Change trip</Button>
        <Button
          loading={book.isPending}
          disabled={selected === null}
          onClick={() => { if (selected !== null) { book.mutate(selected) } }}
        >
          {selected === null
            ? 'Choose an option'
            : selected.policy.requiresApproval
              ? `Request approval · ${formatMoney(selected.totalMinor, selected.currency)}`
              : `Book ${selected.label} · ${formatMoney(selected.totalMinor, selected.currency)}`}
        </Button>
      </div>
    </div>
  )
}

function Step({ state, title, detail }: { readonly state: 'done' | 'next' | 'later'; readonly title: string; readonly detail: string }) {
  return (
    <li className="relative">
      <span
        aria-hidden="true"
        className={cn(
          'absolute -left-[31px] top-0.5 grid size-[18px] place-items-center rounded-full border-2 bg-surface',
          state === 'done' && 'border-[var(--bg-brand)] bg-brand',
          state === 'next' && 'border-[var(--bg-brand)]',
          state === 'later' && 'border-line-strong',
        )}
      >
        {state === 'done' && <Icon name="check" size={10} className="text-fg-on-brand" />}
      </span>
      <p className={cn('text-[14px] font-medium', state === 'later' ? 'text-fg-tertiary' : 'text-fg')}>{title}</p>
      <p className="font-mono text-[11px] text-fg-tertiary">{detail}</p>
    </li>
  )
}

function seats(vehicleClass: string): string {
  switch (vehicleClass) {
    case 'Xl':
      return '6 seats'
    case 'Comfort':
      return 'Newer cars'
    default:
      return '4 seats'
  }
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
