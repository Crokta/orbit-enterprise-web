import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type SyntheticEvent, useEffect, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Banner } from '../../components/ui/Banner'
import { Field, TextInput } from '../../components/ui/Inputs'
import { api } from '../../lib/api/client'
import { ApiError } from '../../lib/api/problem'
import { deviceFingerprint, isSessionValid, refreshAccessToken, setSession } from '../../lib/auth/session'
import { onboarding } from './api'

interface Challenge {
  readonly challengeId: string
  readonly expiresAt: string
}

interface TokenPair {
  readonly accessToken: string
  readonly refreshToken: string
  readonly familyId: string
  readonly expiresInSeconds: number
}

type Step = 'checking' | 'details' | 'code' | 'claiming' | 'failed'

/**
 * The onboarding link.
 *
 * Whoever opens it has a company waiting and, usually, no Orbit account. So the page does
 * three things in order: makes them a sign-in (a six-digit code to the work email the link
 * went to), claims the company against it, and hands over to the wizard. Somebody who
 * already has an account gets the code as a sign-in instead of a sign-up — same screen,
 * same code, no "you already have an account" dead end.
 */
export function OnboardingEntryPage() {
  // The token is the last path segment. Read from the location rather than the router's
  // typed params: it is an opaque string the page hands straight back to the server.
  const token = decodeURIComponent(window.location.pathname.split('/').filter((part) => part.length > 0).pop() ?? '')
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('checking')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [mode, setMode] = useState<'sign-up' | 'sign-in'>('sign-up')
  const [problem, setProblem] = useState<string | null>(null)

  const claim = useMutation({
    mutationFn: () => onboarding.claim(token),
    onSuccess: () => { void navigate({ to: '/setup', replace: true }) },
    onError: (failure) => {
      setProblem(failure instanceof ApiError ? failure.message : 'The link could not be opened.')
      setStep('failed')
    },
  })

  // Already signed in — perhaps they clicked the link twice. Straight to the claim.
  useEffect(() => {
    const lifetime = { cancelled: false }

    void (async () => {
      if (isSessionValid() || (await refreshAccessToken())) {
        if (!lifetime.cancelled) {
          setStep('claiming')
          claim.mutate()
        }
      } else if (!lifetime.cancelled) {
        setStep('details')
      }
    })()

    return () => { lifetime.cancelled = true }
    // Runs once on arrival; the claim mutation is stable for the page's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const start = useMutation({
    mutationFn: async (): Promise<Challenge> => {
      const address = email.trim().toLowerCase()

      try {
        const created = await api.post<Challenge>('/v1/auth/signup', {
          json: { displayName: name.trim(), email: address, phoneNumber: phone.trim(), role: 'rider', deviceFingerprint: deviceFingerprint() },
        })
        setMode('sign-up')
        return created
      } catch (failure) {
        // An address that already has an account is signed in, not refused. The code
        // that arrives is a sign-in code, and the page says so.
        if (failure instanceof ApiError && (failure.status === 409 || failure.code.includes('exists') || failure.code.includes('taken'))) {
          const signIn = await api.post<Challenge>('/v1/auth/email/otp', { json: { email: address, deviceFingerprint: deviceFingerprint() } })
          setMode('sign-in')
          return signIn
        }

        throw failure
      }
    },
    onSuccess: (created) => {
      setChallenge(created)
      setCode('')
      setStep('code')
    },
  })

  const verify = useMutation({
    mutationFn: () =>
      api.post<TokenPair>('/v1/auth/email/otp/verify', {
        json: { challengeId: challenge?.challengeId, code: code.trim(), deviceFingerprint: deviceFingerprint() },
      }),
    onSuccess: (pair) => {
      setSession(pair.accessToken, pair.expiresInSeconds, { refreshToken: pair.refreshToken, familyId: pair.familyId })
      setStep('claiming')
      claim.mutate()
    },
  })

  function onStart(event: SyntheticEvent) {
    event.preventDefault()
    start.mutate()
  }

  function onVerify(event: SyntheticEvent) {
    event.preventDefault()
    verify.mutate()
  }

  const canStart = name.trim().length > 1 && email.includes('@') && phone.trim().length >= 10

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[460px] rounded-xl border border-line-subtle bg-surface p-8 shadow-[var(--shadow-e2)]">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-brand text-[16px] font-semibold text-fg-on-brand">O</span>
          <div>
            <p className="text-[16px] font-semibold leading-5">Orbit Business</p>
            <p className="text-[12px] text-fg-tertiary">Account setup</p>
          </div>
        </div>

        {step === 'checking' && <p className="text-[14px] text-fg-secondary">Opening your link…</p>}

        {step === 'claiming' && <p className="text-[14px] text-fg-secondary">Setting up your account…</p>}

        {step === 'failed' && (
          <div className="space-y-4">
            <Banner tone="danger" title="This link did not work">{problem}</Banner>
            <p className="text-[13px] text-fg-secondary">
              Links are personal and stop working when a new one is sent. Ask your onboarding manager for a fresh one, or sign in if your company is already set up.
            </p>
            <Button variant="secondary" onClick={() => { void navigate({ to: '/sign-in' }) }}>Go to sign in</Button>
          </div>
        )}

        {step === 'details' && (
          <form onSubmit={onStart} className="space-y-5">
            <div>
              <h1 className="text-[22px] font-semibold leading-7">Create your sign-in</h1>
              <p className="mt-1 text-[14px] text-fg-secondary">
                Use the work email this link was sent to. We will send a six-digit code to confirm it — no password to remember.
              </p>
            </div>

            <Field label="Full name" htmlFor="ob-name">
              <TextInput id="ob-name" value={name} onChange={(e) => { setName(e.target.value) }} autoComplete="name" autoFocus />
            </Field>
            <Field label="Work email" htmlFor="ob-email" hint="The address the onboarding email arrived at.">
              <TextInput id="ob-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value) }} autoComplete="email" />
            </Field>
            <Field label="Mobile number" htmlFor="ob-phone" hint="For ride updates when you travel yourself.">
              <TextInput id="ob-phone" type="tel" value={phone} onChange={(e) => { setPhone(e.target.value) }} placeholder="+234 809 553 2210" autoComplete="tel" />
            </Field>

            {start.isError && (
              <Banner tone="danger">{start.error instanceof ApiError ? start.error.message : 'Something went wrong. Try again.'}</Banner>
            )}

            <Button type="submit" size="lg" className="w-full" loading={start.isPending} disabled={!canStart}>
              Send me a code
            </Button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={onVerify} className="space-y-5">
            <div>
              <h1 className="text-[22px] font-semibold leading-7">{mode === 'sign-up' ? 'Confirm your email' : 'Sign in'}</h1>
              <p className="mt-1 text-[14px] text-fg-secondary">
                {mode === 'sign-up'
                  ? `We emailed a six-digit code to ${email.trim().toLowerCase()}. Enter it to confirm your address and create your sign-in.`
                  : `${email.trim().toLowerCase()} already has an Orbit account, so we emailed it a sign-in code instead.`}
              </p>
            </div>

            <Field label={mode === 'sign-up' ? 'Six-digit code from the sign-up email' : 'Six-digit code from the sign-in email'} htmlFor="ob-code">
              <TextInput
                id="ob-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')) }}
                className="font-mono text-[20px] tracking-[0.4em]"
                autoFocus
              />
            </Field>

            {verify.isError && (
              <Banner tone="danger">{verify.error instanceof ApiError ? verify.error.message : 'That code did not work.'}</Banner>
            )}

            <Button type="submit" size="lg" className="w-full" loading={verify.isPending || claim.isPending} disabled={code.length !== 6}>
              {mode === 'sign-up' ? 'Confirm and continue' : 'Sign in and continue'}
            </Button>

            <button type="button" onClick={() => { setStep('details') }} className="w-full text-center text-[13px] text-fg-tertiary hover:text-fg">
              Wrong address? Go back
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
