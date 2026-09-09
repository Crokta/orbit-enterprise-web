import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
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
  /** Whether the account can sign in with a password at all. Absent on old identity builds. */
  readonly hasPassword?: boolean
}

type Step = 'checking' | 'details' | 'code' | 'password' | 'claiming' | 'failed'

/** Identity's own floor. Saying so here beats a round trip that comes back with the rule. */
const MinPasswordLength = 12

/**
 * The onboarding link.
 *
 * Whoever opens it has a company waiting and, usually, no Orbit account. So the page does
 * three things in order: makes them a sign-in (a six-digit code to the work email the link
 * went to), claims the company against it, and hands over to the wizard. Somebody who
 * already has an account gets the code as a sign-in instead of a sign-up — same screen,
 * same code, no "you already have an account" dead end.
 *
 * One more thing, and it is not optional: a password. The console's sign-in page takes a
 * password and nothing else, while a code makes an account with none. Before this step,
 * an administrator whose address already had a code-only account — a rider, say — finished
 * setup, signed out, and could never get back in. Identity says on the code sign-in
 * whether a password exists; when it does not, one is chosen here, before the claim.
 */
/**
 * Two front doors, one page.
 *
 * With `selfServe`, there is no link and no invitation: the person founds the company
 * themselves — a name for it, a name for them, a work email, a phone — and lands in the
 * same wizard at the same first step a backoffice-invited company starts from. The
 * sign-in half (code, then a password if the account has none) is identical; only the
 * last call differs: create a company rather than claim one.
 */
export function OnboardingEntryPage({ selfServe = false }: { readonly selfServe?: boolean }) {
  // The token is the last path segment. Read from the location rather than the router's
  // typed params: it is an opaque string the page hands straight back to the server.
  const token = selfServe ? '' : decodeURIComponent(window.location.pathname.split('/').filter((part) => part.length > 0).pop() ?? '')
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('checking')
  // Self-serve with a session already open: only the company is missing, so the
  // details form asks for that and nothing about signing in.
  const [signedIn, setSignedIn] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [mode, setMode] = useState<'sign-up' | 'sign-in'>('sign-up')
  const [problem, setProblem] = useState<string | null>(null)

  const claim = useMutation({
    mutationFn: () =>
      selfServe
        ? onboarding.selfServe({ companyName: companyName.trim(), setupName: name.trim(), setupPhone: phone.trim().length > 0 ? phone.trim() : null })
        : onboarding.claim(token),
    onSuccess: () => { void navigate({ to: '/setup', replace: true }) },
    onError: (failure) => {
      setProblem(failure instanceof ApiError ? failure.message : selfServe ? 'Your company could not be set up.' : 'The link could not be opened.')
      setStep('failed')
    },
  })

  // Already signed in — perhaps they clicked the link twice. Straight to the claim. On
  // the self-serve door there is still a company to name first.
  useEffect(() => {
    const lifetime = { cancelled: false }

    void (async () => {
      if (isSessionValid() || (await refreshAccessToken())) {
        if (!lifetime.cancelled) {
          if (selfServe) {
            setSignedIn(true)
            setStep('details')
          } else {
            setStep('claiming')
            claim.mutate()
          }
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

      // No password yet — every code-made account, whether this page just created it or
      // it was a rider's already. The claim waits until there is one.
      if (pair.hasPassword === false) {
        setStep('password')
        return
      }

      setStep('claiming')
      claim.mutate()
    },
  })

  const setPassword = useMutation({
    // No current password: the account has none, and the token from the code just
    // redeemed is the proof of possession identity accepts in its place.
    mutationFn: () => api.post('/v1/account/credentials', { json: { newPassword } }),
    onSuccess: () => {
      setStep('claiming')
      claim.mutate()
    },
  })

  function onStart(event: SyntheticEvent) {
    event.preventDefault()

    if (signedIn) {
      setStep('claiming')
      claim.mutate()
      return
    }

    start.mutate()
  }

  function onVerify(event: SyntheticEvent) {
    event.preventDefault()
    verify.mutate()
  }

  function onSetPassword(event: SyntheticEvent) {
    event.preventDefault()
    setPassword.mutate()
  }

  const mismatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword !== confirmPassword
  const tooShort = newPassword.length > 0 && newPassword.length < MinPasswordLength
  const canSetPassword = newPassword.length >= MinPasswordLength && newPassword === confirmPassword

  const canStart =
    name.trim().length > 1 &&
    (!selfServe || companyName.trim().length > 1) &&
    (signedIn || (email.includes('@') && phone.trim().length >= 10))

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[460px] rounded-xl border border-line-subtle bg-surface p-8 shadow-[var(--shadow-e2)]">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-brand text-[16px] font-semibold text-fg-on-brand">O</span>
          <div>
            <p className="text-[16px] font-semibold leading-5">Orbit Business</p>
            <p className="text-[12px] text-fg-tertiary">{selfServe ? 'Get started' : 'Account setup'}</p>
          </div>
        </div>

        {step === 'checking' && <p className="text-[14px] text-fg-secondary">Opening your link…</p>}

        {step === 'claiming' && <p className="text-[14px] text-fg-secondary">{selfServe ? 'Creating your company…' : 'Setting up your account…'}</p>}

        {step === 'failed' && (
          <div className="space-y-4">
            <Banner tone="danger" title={selfServe ? 'Your company could not be set up' : 'This link did not work'}>{problem}</Banner>
            <p className="text-[13px] text-fg-secondary">
              {selfServe
                ? 'If your company is already on Orbit, sign in to carry on where it left off. If somebody sent you an invitation, open the link in that email instead.'
                : 'Links are personal and stop working when a new one is sent. Ask your onboarding manager for a fresh one, or sign in if your company is already set up.'}
            </p>
            <Button variant="secondary" onClick={() => { void navigate({ to: '/sign-in' }) }}>Go to sign in</Button>
          </div>
        )}

        {step === 'details' && (
          <form onSubmit={onStart} className="space-y-5">
            <div>
              <h1 className="text-[22px] font-semibold leading-7">{selfServe ? 'Set up your company' : 'Create your sign-in'}</h1>
              <p className="mt-1 text-[14px] text-fg-secondary">
                {signedIn
                  ? 'Name the company and you are into setup. Everything else — registration, billing, people, policy — comes step by step.'
                  : selfServe
                    ? 'A name for the company and a work email to sign in with. We will send a six-digit code to confirm the address, then you will choose a password, and setup starts straight away.'
                    : 'Use the work email this link was sent to. We will send a six-digit code to confirm it, then you will choose the password you sign in with from now on.'}
              </p>
            </div>

            {selfServe && (
              <Field label="Company name" htmlFor="ob-company" hint="As people know it. The registered name and RC number come in the first setup step.">
                <TextInput id="ob-company" value={companyName} onChange={(e) => { setCompanyName(e.target.value) }} autoComplete="organization" autoFocus />
              </Field>
            )}
            <Field label="Full name" htmlFor="ob-name">
              <TextInput id="ob-name" value={name} onChange={(e) => { setName(e.target.value) }} autoComplete="name" autoFocus={!selfServe} />
            </Field>
            {!signedIn && (
              <>
                <Field label="Work email" htmlFor="ob-email" hint={selfServe ? 'Its domain becomes the company\'s: colleagues with the same one can be invited.' : 'The address the onboarding email arrived at.'}>
                  <TextInput id="ob-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value) }} autoComplete="email" />
                </Field>
                <Field label="Mobile number" htmlFor="ob-phone" hint="For ride updates when you travel yourself.">
                  <TextInput id="ob-phone" type="tel" value={phone} onChange={(e) => { setPhone(e.target.value) }} placeholder="+234 809 553 2210" autoComplete="tel" />
                </Field>
              </>
            )}

            {start.isError && (
              <Banner tone="danger">{start.error instanceof ApiError ? start.error.message : 'Something went wrong. Try again.'}</Banner>
            )}

            <Button type="submit" size="lg" className="w-full" loading={start.isPending || claim.isPending} disabled={!canStart}>
              {signedIn ? 'Create company' : 'Send me a code'}
            </Button>

            {selfServe && !signedIn && (
              <p className="text-center text-[13px] text-fg-tertiary">
                Already set up? <Link to="/sign-in" className="text-fg hover:underline">Sign in</Link>
              </p>
            )}
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

        {step === 'password' && (
          <form onSubmit={onSetPassword} className="space-y-5">
            <div>
              <h1 className="text-[22px] font-semibold leading-7">Choose a password</h1>
              <p className="mt-1 text-[14px] text-fg-secondary">
                Your email is confirmed. The console signs you in with a password, so pick one now — it is what you will use at the sign-in page from here on.
              </p>
            </div>

            <Field label="New password" htmlFor="ob-password" hint={`At least ${String(MinPasswordLength)} characters. Length beats punctuation.`}>
              <TextInput id="ob-password" type="password" value={newPassword} onChange={(e) => { setNewPassword(e.target.value) }} autoComplete="new-password" autoFocus />
            </Field>
            <Field label="Confirm password" htmlFor="ob-password-confirm">
              <TextInput id="ob-password-confirm" type="password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value) }} autoComplete="new-password" />
            </Field>

            {mismatch && <p role="alert" className="text-[13px] text-fg-danger">The two passwords do not match.</p>}
            {tooShort && !mismatch && <p className="text-[13px] text-fg-tertiary">{String(MinPasswordLength - newPassword.length)} more characters to go.</p>}

            {setPassword.isError && (
              <Banner tone="danger">{setPassword.error instanceof ApiError ? setPassword.error.message : 'The password could not be saved. Try again.'}</Banner>
            )}

            <Button type="submit" size="lg" className="w-full" loading={setPassword.isPending || claim.isPending} disabled={!canSetPassword}>
              Save password and continue
            </Button>
          </form>
        )}
      </div>
    </main>
  )
}
