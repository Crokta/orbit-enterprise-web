import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Money } from '../../components/ui/Money'
import { api, newIdempotencyKey } from '../../lib/api/client'
import { ApiError } from '../../lib/api/problem'

interface QuoteOption {
  readonly vehicleClass: string
  readonly label: string
  readonly totalMinor: number
  readonly currency: string
  readonly etaMinutes: number
  readonly surgeMultiplier: number
  readonly quoteToken: string
  readonly policy: PolicyVerdict
}

interface PolicyVerdict {
  readonly allowed: boolean
  readonly requiresApproval: boolean
  readonly reason: string | null
}

/**
 * Booking a ride against a corporate account.
 *
 * The quote and the policy check happen together, before anything is booked. Telling an
 * employee their ride is confirmed and then that it needs their manager's approval is
 * how a travel tool loses the trust of the people who have to use it daily.
 */
export function BookRidePage() {
  const [pickup, setPickup] = useState('')
  const [dropoff, setDropoff] = useState('')
  const [costCentre, setCostCentre] = useState('')
  const [selected, setSelected] = useState<QuoteOption | null>(null)

  const quotes = useQuery({
    queryKey: ['quotes', pickup, dropoff, costCentre],
    queryFn: () =>
      api.post<readonly QuoteOption[]>('/v1/enterprise/quotes', {
        json: { pickup, dropoff, costCentre },
      }),

    // Nothing is quoted until there is somewhere to go. Firing on every keystroke
    // would put a pricing call behind each letter typed.
    enabled: pickup.length > 3 && dropoff.length > 3,
    staleTime: 0,
  })

  const book = useMutation({
    mutationFn: (option: QuoteOption) =>
      api.post<{ rideId: string; status: string }>('/v1/enterprise/rides', {
        json: { quoteToken: option.quoteToken, costCentre },

        // One key per intent, generated when the user commits rather than on render.
        // A key regenerated on re-render makes the retry a second ride.
        idempotencyKey: newIdempotencyKey(),
      }),
  })

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-[28px] font-semibold leading-[34px]">Book a ride</h1>

      <div className="space-y-4 rounded-lg border border-line-subtle bg-surface p-5">
        <TextField label="Pick-up" value={pickup} onChange={setPickup} placeholder="Adeola Odeku St, Victoria Island" />
        <TextField label="Drop-off" value={dropoff} onChange={setDropoff} placeholder="Murtala Muhammed Airport" />
        <TextField label="Cost centre" value={costCentre} onChange={setCostCentre} placeholder="ENG-LAGOS" />
      </div>

      {quotes.isPending && quotes.fetchStatus === 'fetching' ? (
        <p className="text-[13px] text-fg-secondary">Getting prices…</p>
      ) : null}

      {quotes.data?.map((option) => (
        <button
          key={option.vehicleClass}
          type="button"
          onClick={() => { setSelected(option); }}
          // A ride the policy forbids is not selectable at all, rather than selectable
          // and then rejected on submit. The reason is shown alongside it, because
          // "not allowed" with no explanation generates a support ticket every time.
          disabled={!option.policy.allowed}
          className={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors ${
            selected?.vehicleClass === option.vehicleClass
              ? 'border-line-brand bg-brand-subtle'
              : 'border-line-subtle bg-surface hover:bg-hover'
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <div>
            <p className="text-[15px] font-medium">{option.label}</p>
            <p className="text-[13px] text-fg-secondary">{option.etaMinutes} min away</p>

            {option.policy.reason !== null ? (
              <p className={`mt-1 text-[13px] ${option.policy.allowed ? 'text-fg-warning' : 'text-fg-danger'}`}>
                {option.policy.reason}
              </p>
            ) : null}
          </div>

          <div className="text-right">
            <Money minorUnits={option.totalMinor} currency={option.currency} className="text-[17px] font-medium" />

            {option.surgeMultiplier > 1 ? (
              // Surge is disclosed before booking, never after. A fare that is higher
              // than quoted with no warning is the single most complained-about thing
              // in ride hailing (§9.3).
              <p className="text-[11px] font-semibold text-fg-surge">
                {option.surgeMultiplier.toFixed(1)}× surge
              </p>
            ) : null}
          </div>
        </button>
      ))}

      {selected !== null ? (
        <div className="flex items-center justify-between rounded-lg border border-line-subtle bg-surface p-4">
          <p className="text-[13px] text-fg-secondary">
            {selected.policy.requiresApproval
              ? 'This trip is outside policy and will be sent to your manager for approval.'
              : 'This trip is within policy and will be booked immediately.'}
          </p>

          <Button
            loading={book.isPending}
            onClick={() => {
              book.mutate(selected)
            }}
          >
            {selected.policy.requiresApproval ? 'Request approval' : 'Book ride'}
          </Button>
        </div>
      ) : null}

      {book.error !== null ? (
        <p role="alert" className="rounded-md bg-danger-subtle px-4 py-3 text-[13px] text-fg-danger">
          {book.error instanceof ApiError && book.error.code === 'pricing.quote_expired'
            ? 'That price is no longer current. Please check the fare again.'
            : 'The ride could not be booked. Nothing has been charged.'}
        </p>
      ) : null}

      {book.data !== undefined ? (
        <p role="status" className="rounded-md bg-success-subtle px-4 py-3 text-[13px] text-fg-success">
          {book.data.status === 'AwaitingApproval'
            ? 'Sent to your manager. You will be notified when it is decided.'
            : 'Booked. Your driver is being found now.'}
        </p>
      ) : null}
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder: string
}) {
  const id = label.toLowerCase().replace(/\W+/g, '-')

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-fg-secondary">
        {label}
      </label>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(event) => { onChange(event.target.value); }}
        className="h-10 w-full rounded-md border border-line bg-surface px-3 text-[15px]"
      />
    </div>
  )
}
