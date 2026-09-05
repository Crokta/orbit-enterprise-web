import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type ChangeEvent, type SyntheticEvent, useEffect, useMemo, useState } from 'react'

import { Badge } from '../../components/ui/Badge'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Icon } from '../../components/ui/Icon'
import { Checkbox, Field, PrefixedInput, RadioCards, Select, TextInput } from '../../components/ui/Inputs'
import { Table, type TableColumn } from '../../components/ui/Table'
import { useToast } from '../../components/ui/Toast'
import { cn } from '../../components/ui/cn'
import { ApiError } from '../../lib/api/problem'
import { queryKeys } from '../../lib/query/client'
import {
  DOCUMENT_HINT,
  type DocumentType,
  type ImportPreview,
  type ImportRow,
  type OnboardingState,
  type PaymentTerms,
  compactNaira,
  naira,
  onboarding,
  onboardingKey,
} from './api'

const STEPS = ['Company', 'Verification', 'Billing', 'Employees', 'Policy', 'Go live'] as const

const DOCUMENT_TYPES: readonly DocumentType[] = ['cac_certificate', 'tin_certificate', 'cac_status_report', 'proof_of_address']

/**
 * The six-step setup, exactly as the design lays it out: a rail of steps on the left, one
 * step at a time on the right, "Continue" at the bottom.
 *
 * The server owns progress. Every save returns the whole state, and the rail, the ticks
 * and the current step come from that rather than from anything kept here — so a company
 * that closes the tab halfway through opens it again exactly where it left off.
 */
export function SetupWizardPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const state = useQuery({ queryKey: onboardingKey, queryFn: onboarding.state })
  const [step, setStep] = useState<number | null>(null)

  useEffect(() => {
    if (state.data !== undefined && step === null) {
      setStep(state.data.currentStep)
    }
  }, [state.data, step])

  useEffect(() => {
    if (state.data?.status === 'live' || state.data?.status === 'at_risk') {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me })
    }
  }, [state.data?.status, queryClient])

  if (state.isError) {
    const message = state.error instanceof ApiError ? state.error.message : 'Setup could not be loaded.'

    return (
      <div className="mx-auto max-w-[560px] py-10">
        <Banner tone="danger" title="Setup is not available for this account">{message}</Banner>
        <p className="mt-4 text-[14px] text-fg-secondary">Only an owner or travel admin of a company that is still setting up can open this page.</p>
        <Button className="mt-4" variant="secondary" onClick={() => { void navigate({ to: '/' }) }}>Go to the console</Button>
      </div>
    )
  }

  if (state.data === undefined || step === null) {
    return <p className="text-[14px] text-fg-tertiary">Loading setup…</p>
  }

  const s = state.data
  const isLive = s.status === 'live' || s.status === 'at_risk'
  const done = [s.company.done, s.verification.done, s.billing.done, s.employees.done, s.policy.done, isLive]

  const update = (next: OnboardingState) => { queryClient.setQueryData(onboardingKey, next) }

  return (
    <div className="-m-8 flex min-h-screen">
      <aside className="w-[300px] shrink-0 border-r border-line-subtle bg-surface px-8 py-8">
        <div className="mb-10 flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-lg bg-brand text-[14px] font-bold text-fg-on-brand">O</span>
          <div>
            <p className="text-[15px] font-semibold leading-5">Orbit Business</p>
            <p className="text-[12px] text-fg-tertiary">Account setup</p>
          </div>
        </div>

        <ol className="space-y-6">
          {STEPS.map((label, index) => {
            const number = index + 1
            const complete = done[index] === true
            const current = step === number
            const reachable = number <= s.currentStep || complete

            return (
              <li key={label}>
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => { setStep(number) }}
                  className={cn('flex items-center gap-3 text-left', !reachable && 'cursor-default opacity-50')}
                >
                  <span
                    className={cn(
                      'grid size-6 place-items-center rounded-full text-[12px] font-semibold',
                      complete ? 'bg-success text-white' : current ? 'bg-brand text-fg-on-brand' : 'bg-subtle text-fg-tertiary',
                    )}
                  >
                    {complete ? <Icon name="check" size={14} /> : number}
                  </span>
                  <span className={cn('text-[15px]', current ? 'font-semibold text-fg' : 'text-fg-secondary')}>{label}</span>
                </button>
              </li>
            )
          })}
        </ol>

        <div className="mt-16 text-[12px] text-fg-tertiary">
          <p className="font-medium text-fg-secondary">Need a hand?</p>
          <p className="mt-1">{s.accountManagerName ?? 'Your onboarding manager'}{s.accountManagerName !== null ? ' · your onboarding manager' : ''}</p>
          {s.accountManagerEmail !== null && <p>{s.accountManagerEmail}</p>}
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-16 py-10">
        <div className="max-w-[1012px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-brand">Step {step} of 6</p>

          {step === 1 && <CompanyStep state={s} onSaved={(next) => { update(next); setStep(2) }} />}
          {step === 2 && <VerificationStep state={s} onChanged={update} onContinue={() => { setStep(3) }} />}
          {step === 3 && <BillingStep state={s} onSaved={(next) => { update(next); setStep(4) }} onBack={() => { setStep(2) }} />}
          {step === 4 && <EmployeesStep state={s} onChanged={update} onContinue={() => { setStep(5) }} onBack={() => { setStep(3) }} />}
          {step === 5 && <PolicyStep state={s} onSaved={(next) => { update(next); setStep(6) }} onBack={() => { setStep(4) }} />}
          {step === 6 && <GoLiveStep state={s} onChanged={update} onBack={() => { setStep(5) }} />}
        </div>
      </main>
    </div>
  )
}

function Heading({ title, children }: { readonly title: string; readonly children: string }) {
  return (
    <div className="mb-6 mt-1">
      <h1 className="text-[30px] font-semibold leading-[36px] tracking-[-0.01em]">{title}</h1>
      <p className="mt-1.5 text-[16px] text-fg-secondary">{children}</p>
    </div>
  )
}

function Footer({ back, onBack, children }: { readonly back?: string; readonly onBack?: (() => void) | undefined; readonly children: React.ReactNode }) {
  return (
    <div className="mt-10 flex items-center gap-4">
      {onBack !== undefined && <Button type="button" variant="ghost" size="lg" onClick={onBack}>{back ?? 'Back'}</Button>}
      {children}
    </div>
  )
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : error instanceof Error && error.message.length > 0 ? error.message : fallback
}

// --- Step 1 ---------------------------------------------------------------------------------

function CompanyStep({ state, onSaved }: { readonly state: OnboardingState; readonly onSaved: (next: OnboardingState) => void }) {
  const c = state.company
  const [legalName, setLegalName] = useState(c.legalName)
  const [rc, setRc] = useState(c.rcNumber ?? '')
  const [tin, setTin] = useState(c.tin ?? '')
  const [industry, setIndustry] = useState(c.industry ?? '')
  const [seats, setSeats] = useState(c.expectedSeatsMin === null ? '' : `${String(c.expectedSeatsMin)} – ${String(c.expectedSeatsMax ?? c.expectedSeatsMin)}`)
  const [address, setAddress] = useState(c.registeredAddress ?? '')
  const [name, setName] = useState(c.setupName ?? '')
  const [role, setRole] = useState(c.setupRole ?? '')
  const [phone, setPhone] = useState(c.setupPhone ?? '')
  const [signatory, setSignatory] = useState(c.signatoryConfirmed)

  const save = useMutation({
    mutationFn: () => {
      const numbers = seats.match(/\d+/g)?.map(Number) ?? []

      return onboarding.saveCompany({
        legalName: legalName.trim(),
        rcNumber: rc.trim(),
        tin: tin.trim(),
        ...(industry.trim().length > 0 ? { industry: industry.trim() } : {}),
        ...(address.trim().length > 0 ? { registeredAddress: address.trim() } : {}),
        ...(numbers[0] !== undefined ? { expectedSeatsMin: numbers[0], expectedSeatsMax: numbers[1] ?? numbers[0] } : {}),
        setupName: name.trim(),
        ...(role.trim().length > 0 ? { setupRole: role.trim() } : {}),
        ...(phone.trim().length > 0 ? { setupPhone: phone.trim() } : {}),
        signatoryConfirmed: signatory,
      })
    },
    onSuccess: onSaved,
  })

  function submit(event: SyntheticEvent) {
    event.preventDefault()
    save.mutate()
  }

  return (
    <form onSubmit={submit}>
      <Heading title="Tell us about your company">This is the legal entity we invoice. You can add trading names and subsidiaries later.</Heading>

      <Card title="Company" subtitle="As registered with the Corporate Affairs Commission">
        <div className="grid gap-4 sm:grid-cols-[1fr_240px]">
          <Field label="Registered company name" htmlFor="c-name">
            <TextInput id="c-name" value={legalName} onChange={(e) => { setLegalName(e.target.value) }} autoFocus />
          </Field>
          <Field label="RC number" htmlFor="c-rc" hint="From your CAC certificate">
            <TextInput id="c-rc" value={rc} onChange={(e) => { setRc(e.target.value) }} placeholder="RC-1509882" />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="TIN" htmlFor="c-tin">
            <TextInput id="c-tin" value={tin} onChange={(e) => { setTin(e.target.value) }} placeholder="TIN-77410925" />
          </Field>
          <Field label="Industry" htmlFor="c-industry">
            <TextInput id="c-industry" value={industry} onChange={(e) => { setIndustry(e.target.value) }} placeholder="Food & beverage" />
          </Field>
          <Field label="Employees" htmlFor="c-seats" hint="Sets your starting seat allowance">
            <TextInput id="c-seats" value={seats} onChange={(e) => { setSeats(e.target.value) }} placeholder="120 – 250" />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Registered address" htmlFor="c-address">
            <TextInput id="c-address" value={address} onChange={(e) => { setAddress(e.target.value) }} placeholder="7 Ligali Ayorinde St, Victoria Island, Lagos" />
          </Field>
        </div>
      </Card>

      <Card title="Your details" subtitle="You become the first Owner on this account" className="mt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="c-you">
            <TextInput id="c-you" value={name} onChange={(e) => { setName(e.target.value) }} />
          </Field>
          <Field label="Role" htmlFor="c-role">
            <TextInput id="c-role" value={role} onChange={(e) => { setRole(e.target.value) }} placeholder="Head of Operations" />
          </Field>
          <Field label="Work email" htmlFor="c-email" hint="We verified this when you signed in">
            <TextInput id="c-email" value={c.setupEmail ?? state.ownerEmail} readOnly disabled />
          </Field>
          <Field label="Phone" htmlFor="c-phone">
            <TextInput id="c-phone" type="tel" value={phone} onChange={(e) => { setPhone(e.target.value) }} placeholder="+234 809 553 2210" />
          </Field>
        </div>
      </Card>

      <div className="mt-5">
        <Checkbox
          checked={signatory}
          onChange={setSignatory}
          label={`I can enter into contracts for ${legalName.trim().length > 0 ? legalName.trim() : 'the company'}`}
          description="We verify this against the directors listed on your CAC record. If you are not a director, your CAC-listed director must approve in the next step."
        />
      </div>

      {save.isError && <Banner tone="danger" className="mt-4">{errorText(save.error, 'The details could not be saved.')}</Banner>}

      <Footer>
        <Button type="submit" size="lg" loading={save.isPending} disabled={!signatory || legalName.trim().length < 2 || rc.trim().length < 5 || tin.trim().length < 8 || name.trim().length < 2}>
          Continue to verification
        </Button>
      </Footer>
    </form>
  )
}

// --- Step 2 ---------------------------------------------------------------------------------

function VerificationStep({ state, onChanged, onContinue }: { readonly state: OnboardingState; readonly onChanged: (next: OnboardingState) => void; readonly onContinue: () => void }) {
  const v = state.verification
  const toast = useToast()
  const [busy, setBusy] = useState<DocumentType | null>(null)
  const [error, setError] = useState<string | null>(null)

  const upload = useMutation({
    mutationFn: ({ type, file }: { readonly type: DocumentType; readonly file: File }) => onboarding.uploadDocument(type, file),
    onMutate: ({ type }) => { setBusy(type); setError(null) },
    onSuccess: (next) => { onChanged(next); toast.notify('Document received') },
    onError: (failure) => { setError(errorText(failure, 'The upload failed.')) },
    onSettled: () => { setBusy(null) },
  })

  const remove = useMutation({
    mutationFn: (documentId: string) => onboarding.removeDocument(documentId),
    onSuccess: onChanged,
    onError: (failure) => { setError(errorText(failure, 'The document could not be removed.')) },
  })

  const submit = useMutation({
    mutationFn: onboarding.submitVerification,
    onSuccess: (next) => { onChanged(next); toast.notify('Submitted for verification'); onContinue() },
    onError: (failure) => { setError(errorText(failure, 'Verification could not be submitted.')) },
  })

  const pending = v.status === 'submitted'
  const verified = v.status === 'verified'
  const rejected = v.status === 'rejected'

  function pick(type: DocumentType) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''

      if (file !== undefined) {
        upload.mutate({ type, file })
      }
    }
  }

  return (
    <div>
      <Heading title={`Verify ${state.company.legalName}`}>Nigerian law requires us to verify any business we invoice. Most companies are verified within one working day.</Heading>

      {verified && <Banner tone="success" title="Verified" className="mb-4">CAC and TIN matched on {v.decidedAt === null ? '' : new Date(v.decidedAt).toLocaleDateString('en-NG')}. Booking opens when you go live.</Banner>}
      {pending && <Banner tone="info" title="With our compliance team" className="mb-4">Submitted {v.submittedAt === null ? '' : new Date(v.submittedAt).toLocaleString('en-NG')}. You can keep setting up — add employees and set policy now. Booking unlocks once verification passes.</Banner>}
      {rejected && <Banner tone="danger" title="Sent back" className="mb-4">{v.rejectionReason} Re-upload the documents marked below and submit again.</Banner>}

      <Card title="Documents" subtitle="Clear scans or PDFs. Photos of screens are usually rejected.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {DOCUMENT_TYPES.map((type) => {
            const doc = v.documents.find((d) => d.type === type)
            const label = doc?.label ?? labelFor(type)
            const status = doc?.status
            const locked = pending || verified

            return (
              <div key={type}>
                <label
                  className={cn(
                    'grid h-[88px] cursor-pointer place-items-center rounded-lg border',
                    status === 'accepted' || (status === 'received' && !rejected) ? 'border-[color:var(--bg-success)] bg-success-subtle' : status === 'rejected' ? 'border-[color:var(--bg-danger)] bg-danger-subtle' : 'border-dashed border-line-strong bg-surface-sunken',
                    locked && 'cursor-not-allowed',
                  )}
                >
                  <input type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" disabled={locked || busy !== null} onChange={pick(type)} />
                  {busy === type ? (
                    <span className="text-[13px] text-fg-tertiary">Uploading…</span>
                  ) : status === 'rejected' ? (
                    <Icon name="warning" size={22} className="text-fg-danger" />
                  ) : doc !== undefined ? (
                    <Icon name="check" size={22} className="text-fg-success" />
                  ) : (
                    <Icon name="download" size={22} className="text-fg-tertiary" />
                  )}
                </label>
                <div className="mt-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium">{label}</p>
                    <p className="text-[12px] text-fg-tertiary">
                      {doc === undefined ? `Not uploaded · ${DOCUMENT_HINT[type]}` : `${doc.fileName} · ${(doc.sizeBytes / 1024).toFixed(0)} KB`}
                    </p>
                    {doc?.note !== null && doc?.note !== undefined && <p className="text-[12px] text-fg-danger">{doc.note}</p>}
                  </div>
                  <Badge tone={status === 'accepted' ? 'success' : status === 'rejected' ? 'danger' : doc !== undefined ? 'success' : 'warning'}>
                    {status === 'accepted' ? 'Accepted' : status === 'rejected' ? 'Re-upload' : doc !== undefined ? 'Received' : 'Required'}
                  </Badge>
                </div>
                {doc !== undefined && !locked && (
                  <button type="button" onClick={() => { remove.mutate(doc.documentId) }} className="mt-1 text-[12px] text-fg-tertiary hover:text-fg-danger">Remove</button>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      <Card title="Signatory" subtitle="Confirmed on step one; compliance checks it against your CAC record" className="mt-4">
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-[14px] font-medium">{state.company.setupName ?? state.ownerEmail}</p>
            <p className="text-[12px] text-fg-tertiary">{state.company.setupRole ?? 'Owner'} · you</p>
          </div>
          <span className={cn('text-[13px] font-medium', state.company.signatoryConfirmed ? 'text-fg-success' : 'text-fg-warning')}>
            {state.company.signatoryConfirmed ? 'Confirmed' : 'Not confirmed'}
          </span>
        </div>
      </Card>

      {!verified && !pending && (
        <Banner tone="info" title="You can keep setting up while we verify" className="mt-4">
          Add employees and set policy now. Booking unlocks once verification passes — usually within one working day.
        </Banner>
      )}

      {error !== null && <Banner tone="danger" className="mt-4">{error}</Banner>}

      <Footer>
        {verified || pending ? (
          <Button type="button" size="lg" onClick={onContinue}>Continue to billing</Button>
        ) : (
          <Button type="button" size="lg" loading={submit.isPending} disabled={v.missing.length > 0} onClick={() => { submit.mutate() }}>
            Submit for verification
          </Button>
        )}
        {v.missing.length > 0 && !verified && !pending && (
          <span className="text-[13px] text-fg-tertiary">{v.missing.length} of 4 documents still needed</span>
        )}
      </Footer>
    </div>
  )
}

function labelFor(type: DocumentType): string {
  switch (type) {
    case 'cac_certificate':
      return 'CAC certificate of incorporation'
    case 'tin_certificate':
      return 'TIN certificate'
    case 'cac_status_report':
      return 'CAC status report (CAC 7A)'
    default:
      return 'Proof of registered address'
  }
}

// --- Step 3 ---------------------------------------------------------------------------------

function BillingStep({ state, onSaved, onBack }: { readonly state: OnboardingState; readonly onSaved: (next: OnboardingState) => void; readonly onBack: () => void }) {
  const b = state.billing
  const [terms, setTerms] = useState<PaymentTerms>(b.paymentTerms)
  const [contact, setContact] = useState(b.billingContactName ?? '')
  const [email, setEmail] = useState(b.billingEmail ?? '')
  const [po, setPo] = useState(b.poNumber ?? '')
  const [address, setAddress] = useState(b.billingAddress ?? 'Same as registered address')

  const save = useMutation({
    mutationFn: () => onboarding.saveBilling({
      paymentTerms: terms,
      billingContactName: contact.trim(),
      billingEmail: email.trim(),
      ...(po.trim().length > 0 ? { poNumber: po.trim() } : {}),
      ...(address.trim().length > 0 ? { billingAddress: address.trim() } : {}),
    }),
    onSuccess: onSaved,
  })

  function submit(event: SyntheticEvent) {
    event.preventDefault()
    save.mutate()
  }

  return (
    <form onSubmit={submit}>
      <Heading title="How you’ll be billed">Rides are billed monthly in arrears. You only pay for rides taken — seats themselves are free.</Heading>

      <Card title="Payment terms">
        <RadioCards<PaymentTerms>
          label="Payment terms"
          value={terms}
          onChange={setTerms}
          columns={3}
          options={[
            { value: 'invoice_net_30', label: 'Invoice · Net 30', description: 'Monthly invoice, pay by transfer within 30 days' },
            { value: 'invoice_net_7', label: 'Invoice · Net 7', description: 'Monthly invoice, pay within 7 days' },
            { value: 'card_on_file', label: 'Card on file', description: 'Charged automatically at month end' },
          ]}
        />
        {terms === 'invoice_net_30' && (
          <Banner tone="warning" title="Net 30 needs a credit check" className="mt-4">
            Your starting limit will be {b.creditLimitMinor === null ? 'set by your account manager' : naira(b.creditLimitMinor)}. Travel suspends if an invoice goes 14 days overdue — we email your billing contacts twice before that.
          </Banner>
        )}
        {terms === 'card_on_file' && (
          <Banner tone="info" className="mt-4">Card capture happens from Invoices once you are live; until then the account is invoiced.</Banner>
        )}
      </Card>

      <Card title="Billing contacts" subtitle="Where invoices and overdue notices go" className="mt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Billing contact" htmlFor="b-contact">
            <TextInput id="b-contact" value={contact} onChange={(e) => { setContact(e.target.value) }} autoFocus />
          </Field>
          <Field label="Billing email" htmlFor="b-email">
            <TextInput id="b-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value) }} placeholder="accounts@company.ng" />
          </Field>
          <Field label="PO number" htmlFor="b-po" hint="Printed on every invoice if your finance team needs it">
            <TextInput id="b-po" value={po} onChange={(e) => { setPo(e.target.value) }} placeholder="PO-2026-0912" />
          </Field>
          <Field label="Billing address" htmlFor="b-address">
            <TextInput id="b-address" value={address} onChange={(e) => { setAddress(e.target.value) }} />
          </Field>
        </div>
      </Card>

      <Card title="Estimate" subtitle={state.company.expectedSeatsMin === null ? 'Based on companies your size in Lagos' : `Based on ${String(state.company.expectedSeatsMin)}–${String(state.company.expectedSeatsMax ?? state.company.expectedSeatsMin)} employees in Lagos`} className="mt-4">
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <p className="text-[12px] text-fg-tertiary">Seats</p>
            <p className="font-mono text-[22px] font-semibold">Free</p>
            <p className="text-[12px] text-fg-tertiary">you pay per ride only</p>
          </div>
          <div>
            <p className="text-[12px] text-fg-tertiary">Commission</p>
            <p className="font-mono text-[22px] font-semibold">{(100 * b.commissionRate).toFixed(0)}% flat</p>
            <p className="text-[12px] text-fg-tertiary">included in the fare</p>
          </div>
          <div>
            <p className="text-[12px] text-fg-tertiary">Est. monthly spend</p>
            <p className="font-mono text-[22px] font-semibold">{compactNaira(b.estimatedMonthlyLowMinor)} – {compactNaira(b.estimatedMonthlyHighMinor)}</p>
            <p className="text-[12px] text-fg-tertiary">at 6–10 rides per active seat</p>
          </div>
        </div>
      </Card>

      {save.isError && <Banner tone="danger" className="mt-4">{errorText(save.error, 'Billing could not be saved.')}</Banner>}

      <Footer onBack={onBack}>
        <Button type="submit" size="lg" loading={save.isPending} disabled={contact.trim().length < 2 || !email.includes('@')}>Continue to employees</Button>
      </Footer>
    </form>
  )
}

// --- Step 4 ---------------------------------------------------------------------------------

type ImportMode = 'csv' | 'sso' | 'invite'

function EmployeesStep({ state, onChanged, onContinue, onBack }: { readonly state: OnboardingState; readonly onChanged: (next: OnboardingState) => void; readonly onContinue: () => void; readonly onBack: () => void }) {
  const toast = useToast()
  const [mode, setMode] = useState<ImportMode>('csv')
  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [rows, setRows] = useState<readonly ImportRow[]>([])
  const [fixing, setFixing] = useState(false)
  const [newCentres, setNewCentres] = useState<readonly { readonly code: string; readonly name: string }[]>([])
  const [error, setError] = useState<string | null>(null)

  const previewUpload = useMutation({
    mutationFn: (file: File) => onboarding.previewImport(file),
    onSuccess: (result, file) => {
      setPreview(result)
      setRows(result.rows)
      setFileName(file.name)
      setFixing(false)
      setNewCentres([])
      setError(null)
    },
    onError: (failure) => { setError(errorText(failure, 'The file could not be read.')) },
  })

  const invite = useMutation({
    mutationFn: () => onboarding.importEmployees(rows, newCentres),
    onSuccess: (result) => {
      onChanged(result.state)
      toast.notify(`${String(result.invited)} employees invited`)
      onContinue()
    },
    onError: (failure) => { setError(errorText(failure, 'The invitations could not be sent.')) },
  })

  const centres = useMemo(
    () => [...(preview?.costCentres ?? state.employees.costCentres), ...newCentres],
    [preview, state.employees.costCentres, newCentres],
  )

  const ready = rows.filter((r) => r.issue === null && r.skip !== true).length
  const attention = rows.filter((r) => r.issue !== null && r.issue !== 'duplicate' && r.skip !== true)

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (file !== undefined) {
      previewUpload.mutate(file)
    }
  }

  function fixRow(row: number, patch: Partial<ImportRow>) {
    setRows((current) => current.map((r) => (r.row === row ? { ...r, ...patch, issue: patch.issue === undefined ? r.issue : patch.issue } : r)))
  }

  function assignCentre(row: number, code: string) {
    if (code === '__new__') {
      return
    }

    fixRow(row, { costCentre: code, issue: null, issueDetail: null })
  }

  function setAllMissing(code: string) {
    setRows((current) => current.map((r) => (r.issue === 'missing_cost_centre' || r.issue === 'unknown_cost_centre' ? { ...r, costCentre: code, issue: null, issueDetail: null } : r)))
  }

  function createCentre(name: string) {
    const code = name.trim().toUpperCase().replace(/[\s_]+/g, '-')

    if (code.length === 0 || centres.some((c) => c.code === code)) {
      return
    }

    setNewCentres((current) => [...current, { code, name: name.trim() }])
    setRows((current) => current.map((r) => (r.issue === 'unknown_cost_centre' && (r.costCentre ?? '').trim().toUpperCase().replace(/[\s_]+/g, '-') === code ? { ...r, costCentre: code, issue: null, issueDetail: null } : r)))
  }

  const columns: readonly TableColumn<ImportRow>[] = [
    { key: 'row', header: 'Row', render: (r) => <span className="tabular text-fg-tertiary">{r.row}</span>, width: '64px' },
    { key: 'name', header: 'Name', render: (r) => r.name },
    { key: 'email', header: 'Email', render: (r) => <span className="font-mono text-[12px]">{r.email}</span> },
    { key: 'cc', header: 'Cost centre', render: (r) => r.costCentre ?? '—' },
    {
      key: 'issue',
      header: 'Issue',
      render: (r) =>
        r.issue === null ? <Badge tone="success">Ready</Badge> : r.issue === 'personal_domain' ? <span className="text-[12px] text-fg-danger">{r.issueDetail}</span> : <Badge tone="warning">{r.issueDetail}</Badge>,
    },
  ]

  return (
    <div>
      <Heading title="Add your team">Upload a CSV or connect your identity provider. Seats are free — you are billed only for rides taken.</Heading>

      {state.employees.done && (
        <Banner tone="success" title={`${String(state.employees.invited)} employees invited`} className="mb-4">
          {state.employees.needingCostCentre > 0 ? `${String(state.employees.needingCostCentre)} rows still need a cost centre — upload a corrected file or add them from Employees later.` : 'Invitations go out when you go live. Upload another file to add more.'}
        </Banner>
      )}

      <RadioCards<ImportMode>
        label="How to add employees"
        value={mode}
        onChange={setMode}
        columns={3}
        options={[
          { value: 'csv', label: 'Upload CSV', description: 'Fastest for a one-off import' },
          { value: 'sso', label: 'Connect SSO directory', description: 'Keeps Orbit in sync automatically' },
          { value: 'invite', label: 'Invite individually', description: 'For small teams or pilots' },
        ]}
      />

      {mode === 'sso' && (
        <Banner tone="info" title="Directory sync is not on the platform yet" className="mt-4">
          Single sign-on and SCIM are on the roadmap. Upload a CSV for now — it takes about a minute — and the directory can take over later without re-inviting anyone.
        </Banner>
      )}

      {mode === 'invite' && (
        <Banner tone="info" title="Invite from the Employees page" className="mt-4">
          Once you go live, Employees → Invite adds people one at a time with a cost centre and a policy. For setup, a CSV of even five rows is quicker.
        </Banner>
      )}

      {mode === 'csv' && (
        <Card title={preview === null ? 'Upload' : 'Import result'} subtitle={preview === null ? 'Columns: name, email, cost centre. A heading row is fine.' : `${fileName ?? 'file'} · ${String(rows.length)} rows`} className="mt-4">
          {preview === null ? (
            <label className="grid h-[120px] cursor-pointer place-items-center rounded-lg border border-dashed border-line-strong bg-surface-sunken text-[14px] text-fg-secondary">
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} disabled={previewUpload.isPending} />
              {previewUpload.isPending ? 'Reading…' : 'Choose a CSV file'}
            </label>
          ) : (
            <>
              <div className="mb-4 grid gap-6 sm:grid-cols-3">
                <div><p className="text-[12px] text-fg-tertiary">Ready to invite</p><p className="font-mono text-[24px] font-semibold text-fg-success">{ready}</p></div>
                <div><p className="text-[12px] text-fg-tertiary">Need attention</p><p className="font-mono text-[24px] font-semibold text-fg-warning">{attention.length}</p></div>
                <div><p className="text-[12px] text-fg-tertiary">Duplicates skipped</p><p className="font-mono text-[24px] font-semibold">{preview.duplicatesSkipped}</p></div>
              </div>

              {!fixing ? (
                <>
                  <Table<ImportRow>
                    columns={columns}
                    rows={attention.length > 0 ? attention.slice(0, 8) : rows.slice(0, 8)}
                    rowKey={(r) => String(r.row)}
                    isPending={false}
                    emptyTitle="Nothing to show"
                    rowClassName={(r) => (r.issue === 'personal_domain' ? 'bg-danger-subtle/40' : undefined)}
                    minWidth={640}
                  />
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {attention.length > 0 && <Button type="button" variant="secondary" onClick={() => { setFixing(true) }}>Fix inline</Button>}
                    <label className="cursor-pointer text-[14px] font-medium text-fg-brand hover:underline">
                      <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} />
                      Upload a different file
                    </label>
                  </div>
                  <p className="mt-3 text-[12px] text-fg-tertiary">You can invite the {ready} valid rows now and fix the other {attention.length} later — nothing is lost.</p>
                </>
              ) : (
                <FixRows rows={attention} centres={centres} domain={state.company.verifiedDomain} onAssign={assignCentre} onEmail={(row, email) => { fixRow(row, { email, issue: null, issueDetail: null }) }} onSkip={(row) => { fixRow(row, { skip: true }) }} onSetAll={setAllMissing} onCreate={createCentre} onDone={() => { setFixing(false) }} />
              )}
            </>
          )}
        </Card>
      )}

      {error !== null && <Banner tone="danger" className="mt-4">{error}</Banner>}

      <Footer onBack={onBack}>
        {preview !== null && ready > 0 ? (
          <Button type="button" size="lg" loading={invite.isPending} onClick={() => { invite.mutate() }}>Invite {ready} employees</Button>
        ) : (
          <Button type="button" size="lg" variant={state.employees.done ? 'primary' : 'secondary'} onClick={onContinue}>{state.employees.done ? 'Continue to policy' : 'Skip for now'}</Button>
        )}
      </Footer>
    </div>
  )
}

function FixRows({
  rows,
  centres,
  domain,
  onAssign,
  onEmail,
  onSkip,
  onSetAll,
  onCreate,
  onDone,
}: {
  readonly rows: readonly ImportRow[]
  readonly centres: readonly { readonly code: string; readonly name: string }[]
  readonly domain: string | null
  readonly onAssign: (row: number, code: string) => void
  readonly onEmail: (row: number, email: string) => void
  readonly onSkip: (row: number) => void
  readonly onSetAll: (code: string) => void
  readonly onCreate: (name: string) => void
  readonly onDone: () => void
}) {
  const [creating, setCreating] = useState('')
  const [emails, setEmails] = useState<Record<number, string>>({})
  const fixed = rows.filter((r) => r.issue === null).length

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-subtle p-3">
        <div className="min-w-[200px] flex-1">
          <p className="text-[13px] font-medium">{fixed} of {rows.length} fixed</p>
          <div className="mt-1.5 h-1.5 rounded-full bg-subtle"><div className="h-1.5 rounded-full bg-brand" style={{ width: `${String(rows.length === 0 ? 0 : (100 * fixed) / rows.length)}%` }} /></div>
        </div>
        {centres.length > 0 && (
          <Select aria-label="Set all missing to" value="" onChange={(e) => { if (e.target.value !== '') onSetAll(e.target.value) }} className="w-auto">
            <option value="">Set all missing to…</option>
            {centres.map((c) => <option key={c.code} value={c.code}>{c.name} · {c.code}</option>)}
          </Select>
        )}
      </div>

      <ul className="divide-y divide-line-subtle">
        {rows.map((r) => (
          <li key={r.row} className={cn('grid items-center gap-3 py-3 sm:grid-cols-[56px_1fr_1fr_1fr_90px]', r.issue !== null && 'bg-warning-subtle/30')}>
            <span className="tabular text-[12px] text-fg-tertiary">{r.row}</span>
            <div className="min-w-0">
              <p className="text-[14px] font-medium">{r.name}</p>
              <p className="truncate font-mono text-[12px] text-fg-tertiary">{r.email}</p>
            </div>
            <p className={cn('text-[13px]', r.issue === 'personal_domain' ? 'text-fg-danger' : 'text-fg-secondary')}>{r.issue === null ? 'Fixed' : r.issueDetail}</p>
            <div>
              {r.issue === 'personal_domain' || r.issue === 'invalid_email' ? (
                <TextInput
                  aria-label={`Work email for row ${String(r.row)}`}
                  placeholder={domain === null ? 'Work email' : `Enter a @${domain} address`}
                  value={emails[r.row] ?? ''}
                  onChange={(e) => { setEmails((c) => ({ ...c, [r.row]: e.target.value })) }}
                  onBlur={() => { const value = emails[r.row]?.trim() ?? ''; if (value.includes('@')) onEmail(r.row, value.toLowerCase()) }}
                />
              ) : r.issue === 'missing_cost_centre' || r.issue === 'unknown_cost_centre' ? (
                <Select aria-label={`Cost centre for row ${String(r.row)}`} value={r.costCentre !== null && centres.some((c) => c.code === r.costCentre) ? r.costCentre : ''} onChange={(e) => { onAssign(r.row, e.target.value) }}>
                  <option value="">Choose a cost centre</option>
                  {centres.map((c) => <option key={c.code} value={c.code}>{c.name} · {c.code}</option>)}
                </Select>
              ) : r.issue === null ? (
                <span className="text-[13px] text-fg-secondary">{r.costCentre ?? r.email}</span>
              ) : (
                <span className="text-[13px] text-fg-tertiary">Will be skipped</span>
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Badge tone={r.issue === null ? 'success' : 'warning'}>{r.issue === null ? 'Ready' : 'Needs fixing'}</Badge>
              {r.issue !== null && <button type="button" onClick={() => { onSkip(r.row) }} className="text-[12px] text-fg-tertiary hover:text-fg">Skip</button>}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Field label="Create a cost centre" htmlFor="new-cc" hint="For a code in the file that does not exist yet" className="min-w-[260px]">
          <TextInput id="new-cc" value={creating} onChange={(e) => { setCreating(e.target.value) }} placeholder="Warehouse-3" />
        </Field>
        <Button type="button" variant="secondary" disabled={creating.trim().length === 0} onClick={() => { onCreate(creating); setCreating('') }}>Add cost centre</Button>
        <span className="flex-1" />
        <Button type="button" variant="ghost" onClick={onDone}>Back to import</Button>
      </div>
      <p className="mt-3 text-[12px] text-fg-tertiary">Skipped rows stay in the file and can be invited later from Employees. Nothing is deleted.</p>
    </div>
  )
}

// --- Step 5 ---------------------------------------------------------------------------------

function PolicyStep({ state, onSaved, onBack }: { readonly state: OnboardingState; readonly onSaved: (next: OnboardingState) => void; readonly onBack: () => void }) {
  const p = state.policy
  const [cap, setCap] = useState(String((p.perRideCapMinor ?? p.suggestedCapMinor) / 100))
  const [from, setFrom] = useState(p.hoursFrom ?? '07:00')
  const [to, setTo] = useState(p.hoursTo ?? '20:00')
  const [weekdays, setWeekdays] = useState(p.weekdaysOnly)
  const [airport, setAirport] = useState(p.airportRunsBypassCap)
  const [reason, setReason] = useState(p.requireReasonForEveryRide)
  const [project, setProject] = useState(p.requireProjectCode)
  const [personal, setPersonal] = useState(p.allowPersonalTrips)
  const [approver, setApprover] = useState(p.defaultApproverEmployeeId ?? state.ownerEmployeeId)
  const [escalate, setEscalate] = useState(String(p.escalateAfterMinutes))
  const [fourEyes, setFourEyes] = useState(p.fourEyesOverMinor !== null)
  const [fourEyesOver, setFourEyesOver] = useState(String((p.fourEyesOverMinor ?? 50_000_00) / 100))

  const save = useMutation({
    mutationFn: () => onboarding.savePolicy({
      perRideCapMinor: Math.round(Number.parseFloat(cap.replace(/,/g, '')) * 100),
      hoursFrom: from,
      hoursTo: to,
      weekdaysOnly: weekdays,
      airportRunsBypassCap: airport,
      requireReasonForEveryRide: reason,
      requireProjectCode: project,
      allowPersonalTrips: personal,
      defaultApproverEmployeeId: approver,
      escalateAfterMinutes: Number.parseInt(escalate, 10) || 60,
      ...(fourEyes ? { fourEyesOverMinor: Math.round(Number.parseFloat(fourEyesOver.replace(/,/g, '')) * 100) } : {}),
    }),
    onSuccess: onSaved,
  })

  function submit(event: SyntheticEvent) {
    event.preventDefault()
    save.mutate()
  }

  const capMinor = Math.round((Number.parseFloat(cap.replace(/,/g, '')) || 0) * 100)

  return (
    <form onSubmit={submit}>
      <Heading title="Set your travel policy">We have suggested a starting policy based on companies your size in Lagos. Change anything — you can edit it later too.</Heading>

      <Card title="Default policy" subtitle="Applies to everyone unless you add more policies later">
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_160px]">
          <Field label="Per-ride cap" htmlFor="p-cap" hint="Rides above this need approval">
            <PrefixedInput id="p-cap" prefix="₦" inputMode="numeric" value={cap} onChange={(e) => { setCap(e.target.value) }} />
          </Field>
          <Field label="Allowed hours" htmlFor="p-from">
            <div className="flex items-center gap-2">
              <TextInput id="p-from" type="time" value={from} onChange={(e) => { setFrom(e.target.value) }} />
              <span className="text-fg-tertiary">–</span>
              <TextInput aria-label="Until" type="time" value={to} onChange={(e) => { setTo(e.target.value) }} />
            </div>
          </Field>
          <Field label="Days" htmlFor="p-days">
            <Select id="p-days" value={weekdays ? 'weekdays' : 'all'} onChange={(e) => { setWeekdays(e.target.value === 'weekdays') }}>
              <option value="weekdays">Mon – Fri</option>
              <option value="all">Every day</option>
            </Select>
          </Field>
        </div>

        <Banner tone="info" className="mt-4">
          Companies your size in Lagos typically set {naira(p.suggestedCapMinor)}. At that cap, about 8% of rides need approval — enough to catch outliers without creating a queue.
          {capMinor > 0 && capMinor !== p.suggestedCapMinor && ` You have set ${naira(capMinor)}.`}
        </Banner>

        <div className="mt-5 space-y-4">
          <Checkbox checked={airport} onChange={setAirport} label="Airport runs bypass the cap" description="Recommended — airport fares vary a lot with traffic" />
          <Checkbox checked={reason} onChange={setReason} label="Require a reason for every ride" description="Adds a mandatory field at booking" />
          <Checkbox checked={project} onChange={setProject} label="Require a project code" description="Only if your finance team codes travel to projects" />
          <Checkbox checked={personal} onChange={setPersonal} label="Allow personal trips on the company account" description="Billed to the employee, not the company" />
        </div>
      </Card>

      <Card title="Approvals" subtitle="Who signs off when a ride is over cap" className="mt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Default approver" htmlFor="p-approver">
            <Select id="p-approver" value={approver} onChange={(e) => { setApprover(e.target.value) }}>
              {p.approvers.map((a) => (
                <option key={a.employeeId} value={a.employeeId}>{a.name}{a.employeeId === state.ownerEmployeeId ? ' · you' : ''}</option>
              ))}
              {!p.approvers.some((a) => a.employeeId === state.ownerEmployeeId) && <option value={state.ownerEmployeeId}>You</option>}
            </Select>
          </Field>
          <Field label="Escalates after" htmlFor="p-escalate" hint="Then goes to the cost centre owner">
            <Select id="p-escalate" value={escalate} onChange={(e) => { setEscalate(e.target.value) }}>
              <option value="30">30 minutes</option>
              <option value="60">60 minutes</option>
              <option value="120">2 hours</option>
              <option value="240">4 hours</option>
            </Select>
          </Field>
        </div>
        <div className="mt-5 space-y-3">
          <Checkbox checked={fourEyes} onChange={setFourEyes} label={`Four-eyes on rides over ${naira(Math.round((Number.parseFloat(fourEyesOver.replace(/,/g, '')) || 0) * 100))}`} description="A second approver from a different team must also sign off" />
          {fourEyes && (
            <div className="max-w-[240px]">
              <PrefixedInput aria-label="Four-eyes threshold" prefix="₦" inputMode="numeric" value={fourEyesOver} onChange={(e) => { setFourEyesOver(e.target.value) }} />
            </div>
          )}
        </div>
      </Card>

      {save.isError && <Banner tone="danger" className="mt-4">{errorText(save.error, 'The policy could not be saved.')}</Banner>}

      <Footer onBack={onBack}>
        <Button type="submit" size="lg" loading={save.isPending} disabled={capMinor <= 0}>Continue to go live</Button>
      </Footer>
    </form>
  )
}

// --- Step 6 ---------------------------------------------------------------------------------

function GoLiveStep({ state, onChanged, onBack }: { readonly state: OnboardingState; readonly onChanged: (next: OnboardingState) => void; readonly onBack: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [accepted, setAccepted] = useState(state.goLive.termsAcceptedAt !== null)
  const live = state.status === 'live' || state.status === 'at_risk'

  const go = useMutation({
    mutationFn: onboarding.goLive,
    onSuccess: (next) => {
      onChanged(next)
      void queryClient.invalidateQueries({ queryKey: queryKeys.me })
    },
  })

  const items: readonly { readonly label: string; readonly detail: string; readonly done: boolean }[] = [
    { label: 'Company details', detail: `${state.company.legalName} · ${state.company.rcNumber ?? '—'}`, done: state.company.done },
    {
      label: 'Verification',
      detail: state.verification.status === 'verified'
        ? `Approved ${state.verification.decidedAt === null ? '' : new Date(state.verification.decidedAt).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · CAC and TIN matched`
        : state.verification.status === 'submitted' ? 'With compliance · usually one working day' : 'Not submitted',
      done: state.verification.status === 'verified',
    },
    { label: 'Billing', detail: `${termsLabel(state.billing.paymentTerms)}${state.billing.creditLimitMinor === null ? '' : ` · limit ${naira(state.billing.creditLimitMinor)}`}`, done: state.billing.done },
    { label: 'Employees', detail: state.employees.invited === 0 ? 'Nobody invited yet — you can add people after going live' : `${String(state.employees.invited)} invited${state.employees.needingCostCentre > 0 ? ` · ${String(state.employees.needingCostCentre)} still need a cost centre` : ''}`, done: state.employees.done && state.employees.needingCostCentre === 0 },
    { label: 'Policy', detail: state.policy.perRideCapMinor === null ? 'Not set' : `${naira(state.policy.perRideCapMinor)} cap · ${state.policy.hoursFrom ?? '00:00'}–${state.policy.hoursTo ?? '24:00'}${state.policy.weekdaysOnly ? ' Mon–Fri' : ''}`, done: state.policy.done },
  ]

  return (
    <div>
      <Heading title={live ? 'You’re live' : 'You’re ready to go live'}>
        {live ? `${state.companyName} is live. Employees can book, and rides over cap come to you for approval.` : `Everything is set up. Here is what happens when you switch ${state.companyName} on.`}
      </Heading>

      <Card title="Setup status">
        <ol className="relative ml-3 space-y-5 border-l-2 border-line-subtle pl-6">
          {items.map((item) => (
            <li key={item.label} className="relative">
              <span className={cn('absolute -left-[31px] top-0.5 grid size-5 place-items-center rounded-full', item.done ? 'bg-success text-white' : 'bg-brand text-fg-on-brand')}>
                {item.done ? <Icon name="check" size={12} /> : <span className="size-2 rounded-full bg-white" />}
              </span>
              <p className="text-[15px] font-medium">{item.label}</p>
              <p className="font-mono text-[12px] text-fg-tertiary">{item.detail}</p>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="What happens next" className="mt-4">
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <Icon name="users" size={20} className="text-fg-brand" />
            <p className="mt-2 text-[14px] font-medium">{state.employees.invited} invites go out</p>
            <p className="text-[12px] text-fg-tertiary">Each employee gets an email with a link to download the app and sign in with their work email.</p>
          </div>
          <div>
            <Icon name="car" size={20} className="text-fg-brand" />
            <p className="mt-2 text-[14px] font-medium">Booking opens immediately</p>
            <p className="text-[12px] text-fg-tertiary">Employees can book straight away. Rides over {state.policy.perRideCapMinor === null ? 'the cap' : naira(state.policy.perRideCapMinor)} come to you for approval.</p>
          </div>
          <div>
            <Icon name="file" size={20} className="text-fg-brand" />
            <p className="mt-2 text-[14px] font-medium">First invoice {new Date(state.goLive.firstInvoiceOn).toLocaleDateString('en-NG', { day: 'numeric', month: 'long' })}</p>
            <p className="text-[12px] text-fg-tertiary">Covering this month's rides. Nothing is charged before then.</p>
          </div>
        </div>
      </Card>

      {state.employees.needingCostCentre > 0 && (
        <Banner tone="warning" title={`${String(state.employees.needingCostCentre)} employees will not be invited yet`} className="mt-4">
          They have no cost centre, so their rides could not be billed correctly. Assign one in Employees and invite them any time — going live now does not lock them out.
        </Banner>
      )}

      {!live && state.goLive.blockers.length > 0 && (
        <Banner tone="warning" title="Not quite yet" className="mt-4">
          <ul className="list-disc pl-4">{state.goLive.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
        </Banner>
      )}

      {!live && (
        <div className="mt-5">
          <Checkbox
            checked={accepted}
            onChange={setAccepted}
            label={`I accept the Orbit Business terms on behalf of ${state.companyName}`}
            description={`${(100 * state.billing.commissionRate).toFixed(0)}% commission on every fare · ${termsLabel(state.billing.paymentTerms)} payment terms · travel suspends at 14 days overdue`}
          />
        </div>
      )}

      {go.isError && <Banner tone="danger" className="mt-4">{errorText(go.error, 'Going live failed.')}</Banner>}

      <Footer onBack={live ? undefined : onBack}>
        {live ? (
          <Button type="button" size="lg" onClick={() => { void navigate({ to: '/dashboard' }) }}>Open the console</Button>
        ) : (
          <Button type="button" size="lg" loading={go.isPending} disabled={!accepted || !state.goLive.canGoLive} onClick={() => { go.mutate() }}>Go live</Button>
        )}
      </Footer>
    </div>
  )
}

function termsLabel(terms: PaymentTerms): string {
  switch (terms) {
    case 'invoice_net_7':
      return 'Invoice · Net 7'
    case 'card_on_file':
      return 'Card on file'
    default:
      return 'Invoice · Net 30'
  }
}
