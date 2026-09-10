import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type SyntheticEvent, useState } from 'react'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, DefinitionRow } from '../../components/ui/Card'
import { Field, Segmented, Select, TextInput } from '../../components/ui/Inputs'
import { Money } from '../../components/ui/Money'
import { PageHeader } from '../../components/ui/PageHeader'
import { enterprise, vehicleLabel } from '../../lib/api/enterprise'
import { ApiError } from '../../lib/api/problem'
import { formatCount, formatMoney, monthToDateLabel } from '../../lib/format'
import { queryKeys } from '../../lib/query/client'
import { type Place, toE7 } from '../../lib/geocode'
import { useMe } from '../session/useMe'
import { PlaceSearch } from './PlaceSearch'
import { type BookingDraft, loadDraft, saveDraft } from './draft'

/**
 * Book a ride.
 *
 * The trip, the billing and who it is for, then "See prices". The quote and the policy
 * check happen together on the next screen, before anything is booked: telling an
 * employee their ride is confirmed and then that it needs approval is how a travel tool
 * loses the trust of the people who use it daily.
 */
export function BookRidePage() {
  const me = useMe()
  const navigate = useNavigate()
  const previous = loadDraft()

  const [pickup, setPickup] = useState<Place | null>(previous?.pickup ?? null)
  const [dropoff, setDropoff] = useState<Place | null>(previous?.dropoff ?? null)
  const [date, setDate] = useState(previous?.date ?? new Date().toISOString().slice(0, 10))
  const [time, setTime] = useState(previous?.time ?? nextQuarterHour())
  const [costCentre, setCostCentre] = useState(previous?.costCentre ?? '')
  const [projectCode, setProjectCode] = useState(previous?.projectCode ?? '')
  const [reason, setReason] = useState(previous?.reason ?? '')
  const [bookingFor, setBookingFor] = useState<BookingDraft['bookingFor']>(previous?.bookingFor ?? 'me')
  const [passenger, setPassenger] = useState(previous?.passenger ?? '')

  const policy = me.data?.policy ?? null
  const effectiveCostCentre = costCentre || me.data?.costCentreCode || null

  // The company's active cost centres, for anyone who books. The admin list carries
  // budgets and is closed to members, which is why the form has its own call.
  const costCentres = useQuery({ queryKey: queryKeys.costCentres.mine, queryFn: enterprise.costCentres.mine })
  const otherCentres = (costCentres.data ?? []).filter((centre) => centre.code !== me.data?.costCentreCode)

  const quote = useMutation({
    mutationFn: () => {
      if (pickup === null || dropoff === null) {
        throw new Error('Choose a pick-up and a destination')
      }

      return enterprise.booking.quote({
        pickupLatE7: toE7(pickup.latitude),
        pickupLonE7: toE7(pickup.longitude),
        dropoffLatE7: toE7(dropoff.latitude),
        dropoffLonE7: toE7(dropoff.longitude),
        costCentre: effectiveCostCentre,
      })
    },
    onSuccess: (options) => {
      if (pickup === null || dropoff === null) {
        return
      }

      saveDraft({ pickup, dropoff, date, time, costCentre: effectiveCostCentre, projectCode, reason, bookingFor, passenger, options })
      void navigate({ to: '/book/choose' })
    },
  })

  function submit(event: SyntheticEvent) {
    event.preventDefault()
    quote.mutate()
  }

  function saveAsDraft() {
    if (pickup !== null && dropoff !== null) {
      saveDraft({ pickup, dropoff, date, time, costCentre: effectiveCostCentre, projectCode, reason, bookingFor, passenger, options: [] })
    }
  }

  const company = me.data?.company.name ?? 'your company'
  const withinPolicy = me.data !== undefined && me.data.policyBreachesThisMonth === 0

  return (
    <div className="space-y-6">
      <PageHeader title="Book a ride" subtitle={`Your rides are billed to ${company} under your cost centre`} />

      <form onSubmit={submit} className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
        <div className="space-y-4">
          <Card title="Trip">
            <div className="space-y-4">
              <Field label="Pick-up" htmlFor="pickup" hint={pickup?.address}>
                <PlaceSearch id="pickup" value={pickup} onChange={setPickup} placeholder="12 Adeola Odeku St, Victoria Island" />
              </Field>
              <Field label="Destination" htmlFor="dropoff" hint={dropoff?.address}>
                <PlaceSearch id="dropoff" value={dropoff} onChange={setDropoff} placeholder="Ikeja GRA, Lagos" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Date" htmlFor="date">
                  <TextInput id="date" type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(event) => { setDate(event.target.value); }} />
                </Field>
                <Field label="Time" htmlFor="time">
                  <TextInput id="time" type="time" value={time} onChange={(event) => { setTime(event.target.value); }} />
                </Field>
              </div>
              <Field
                label="Ride type"
                hint={policy === null || policy.allowedClasses.length === 0 ? 'Every tier is allowed on your account' : `${policy.allowedClasses.map(vehicleLabel).join(' and ')} allowed; other tiers need approval or are unavailable`}
              >
                <div className="flex h-10 items-center rounded-md border border-line bg-surface-sunken px-3 text-[15px] text-fg-secondary">
                  Choose on the next screen
                </div>
              </Field>
            </div>
          </Card>

          <Card title="Billing" subtitle={policy?.requiresCostCentre === true ? 'Required by your travel policy' : 'Optional on your account'}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cost centre" htmlFor="cc">
                <Select id="cc" value={costCentre} onChange={(event) => { setCostCentre(event.target.value); }}>
                  <option value="">{me.data?.costCentreCode === null || me.data === undefined ? 'None' : `${me.data.costCentreName ?? me.data.costCentreCode} · ${me.data.costCentreCode} (yours)`}</option>
                  {costCentres.isPending && <option disabled value="__loading">Loading cost centres…</option>}
                  {costCentres.isError && <option disabled value="__error">Could not load the cost centres — your own still applies</option>}
                  {otherCentres.map((centre) => (
                    <option key={centre.code} value={centre.code}>{`${centre.name} · ${centre.code}`}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Project code" htmlFor="project">
                <TextInput id="project" value={projectCode} placeholder="PRJ-4471 — Payments migration" onChange={(event) => { setProjectCode(event.target.value); }} />
              </Field>
            </div>
            <Field label="Reason for travel" htmlFor="reason" hint="Visible to your approver and finance" className="mt-4">
              <TextInput id="reason" value={reason} placeholder="Client integration workshop at Ikeja office" onChange={(event) => { setReason(event.target.value); }} />
            </Field>
          </Card>

          <Card title="Booking for" subtitle={me.data?.canBookForVisitors === true ? 'You can book on behalf of a colleague or a visitor' : 'Booking for visitors is not enabled on your account'}>
            <Segmented<BookingDraft['bookingFor']>
              label="Booking for"
              value={bookingFor}
              onChange={setBookingFor}
              options={[
                { value: 'me', label: 'Myself' },
                { value: 'colleague', label: 'A colleague' },
                { value: 'visitor', label: 'A visitor', disabled: me.data?.canBookForVisitors !== true },
              ]}
            />
            {bookingFor !== 'me' && (
              <Field label={bookingFor === 'colleague' ? 'Colleague' : 'Visitor'} htmlFor="passenger" hint="Their name is shown to the driver" className="mt-4">
                <TextInput id="passenger" required value={passenger} onChange={(event) => { setPassenger(event.target.value); }} />
              </Field>
            )}
          </Card>

          {quote.error !== null && (
            <p role="alert" className="rounded-md bg-danger-subtle px-4 py-3 text-[13px] text-fg-danger">
              {quote.error instanceof ApiError
                ? quote.error.code === 'employee.cannot_book'
                  ? 'Your account cannot book on the company account. Ask your travel admin.'
                  : quote.error.message
                : quote.error.message}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={saveAsDraft} disabled={pickup === null || dropoff === null}>Save as draft</Button>
            <Button type="submit" loading={quote.isPending} disabled={pickup === null || dropoff === null}>See prices</Button>
          </div>
        </div>

        <div className="space-y-4">
          <Card title="Your policy" subtitle={policy === null ? 'No policy applies — every ride books immediately' : `${policy.name} — applies to ${formatCount(policy.activeEmployees)} employees`}>
            {policy !== null && (
              <dl>
                <DefinitionRow label="Per-ride cap" value={policy.approvalThresholdMinor === null ? 'None' : formatMoney(policy.approvalThresholdMinor, policy.currency)} />
                <DefinitionRow label="Hard limit" value={policy.hardCapMinor === null ? 'None' : formatMoney(policy.hardCapMinor, policy.currency)} />
                <DefinitionRow label="Allowed hours" value={policy.permittedFrom === null ? 'Any time' : `${policy.permittedFrom} – ${policy.permittedTo ?? ''}`} />
                <DefinitionRow label="Ride tiers" value={policy.allowedClasses.length === 0 ? 'All' : policy.allowedClasses.map((tier) => vehicleLabel(tier).replace('Orbit ', '')).join(' and ')} />
                <DefinitionRow label="Cost centre" value={policy.requiresCostCentre ? 'Required' : 'Optional'} tone={policy.requiresCostCentre ? 'warning' : 'neutral'} />
                <DefinitionRow label="Surge pricing" value={policy.requiresApprovalForSurge ? 'Needs approval' : 'Allowed'} tone={policy.requiresApprovalForSurge ? 'warning' : 'success'} />
              </dl>
            )}
          </Card>

          <Card title="Your spend" subtitle={monthToDateLabel()}>
            <div className="flex items-end justify-between gap-4">
              <div>
                <Money minorUnits={me.data?.spendThisMonthMinor ?? 0} currency={me.data?.currency ?? 'NGN'} className="text-[28px] font-semibold leading-[34px]" />
                <p className="mt-1 text-[12px] text-fg-tertiary">
                  {formatCount(me.data?.tripsThisMonth ?? 0)} rides · {me.data === undefined ? '' : me.data.policyBreachesThisMonth === 0 ? 'no policy breaches' : `${formatCount(me.data.policyBreachesThisMonth)} needed approval`}
                </p>
              </div>
              <Badge tone={withinPolicy ? 'success' : 'warning'}>{withinPolicy ? 'Within policy' : 'Approvals needed'}</Badge>
            </div>
          </Card>
        </div>
      </form>
    </div>
  )
}

function nextQuarterHour(): string {
  const now = new Date(Date.now() + 15 * 60_000)
  now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0)
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}
