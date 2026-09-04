import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type SyntheticEvent, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { api } from '../../lib/api/client'
import { ApiError } from '../../lib/api/problem'
import { setSession } from '../../lib/auth/session'

interface TokenPair {
  readonly accessToken: string
  readonly expiresInSeconds: number
  readonly mustChangePassword?: boolean
}

interface OtpChallenge {
  readonly challengeId: string
}

/**
 * Enterprise sign-in.
 *
 * Email and password against identity's own endpoint, with an emailed code as the way
 * back in when a password will not do.
 *
 * This page previously posted to `/v1/auth/sign-in` and `/v1/auth/mfa/verify`. Identity
 * implements neither and never has, so every attempt returned a 404 that the console
 * rendered as a generic failure — the console was unusable from the day it was written,
 * and no test caught it because nothing exercised the two together.
 *
 * The password is never stored, never logged and never put in a query string — the last
 * of those is worth stating because a form that GETs instead of POSTs writes credentials
 * into every proxy log between here and the gateway.
 */
export function SignInPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [code, setCode] = useState('')

  const signIn = useMutation({
    mutationFn: (): Promise<TokenPair> =>
      api.post<TokenPair>('/v1/auth/password', { json: { email, password } }),
    onSuccess: (result) => {
      setSession(result.accessToken, result.expiresInSeconds)
      goBackToWhereTheyWere()
    },
  })

  /** Emails a one-time code, for a traveller who cannot get in with a password. */
  const requestCode = useMutation({
    mutationFn: (): Promise<OtpChallenge> =>
      api.post<OtpChallenge>('/v1/auth/email/otp', { json: { email } }),
    onSuccess: (challenge) => { setChallengeId(challenge.challengeId) },
  })

  const verify = useMutation({
    mutationFn: (): Promise<TokenPair> =>
      api.post<TokenPair>('/v1/auth/email/otp/verify', { json: { challengeId, code } }),
    onSuccess: (result) => {
      setSession(result.accessToken, result.expiresInSeconds)
      goBackToWhereTheyWere()
    },
  })

  const active = challengeId === null ? signIn : verify

  /**
   * Returns the user to the page they were trying to reach.
   *
   * As `href`, not `to`. The redirect target arrives from the URL, so it is an
   * arbitrary string rather than one of the router's known route paths — and treating
   * an arbitrary string as a typed route is how a bad link becomes a runtime error
   * instead of a 404.
   */
  function goBackToWhereTheyWere() {
    // Read from the URL rather than from the router's typed search, because the value
    // is an arbitrary path — the router cannot type it as one of its known routes, and
    // pretending otherwise turns a bad link into a runtime error instead of a 404.
    const target = new URLSearchParams(window.location.search).get('redirect')

    // Same-origin only, and the `//` check matters: `//evil.example` is a
    // protocol-relative URL, not a path. Without it the sign-in page is an open
    // redirect — a link that authenticates the user and then hands them to somebody
    // else's site, with the whole flow looking entirely legitimate.
    void (target !== null && target.startsWith('/') && !target.startsWith('//')
      ? navigate({ href: target })
      : navigate({ to: '/' }))
  }

  function onSubmit(event: SyntheticEvent) {
    event.preventDefault()
    active.mutate()
  }

  /** Switches to the emailed-code path without losing the address already typed. */
  function useCodeInstead() {
    if (email.length > 0) {
      requestCode.mutate()
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-line-subtle bg-surface p-6 shadow-[var(--shadow-e2)]"
      >
        <div className="space-y-1">
          <div className="size-8 rounded-full bg-brand" aria-hidden="true" />
          <h1 className="text-[24px] font-semibold leading-[30px]">
            {challengeId === null ? 'Sign in to Orbit for Business' : 'Enter your verification code'}
          </h1>
          <p className="text-[13px] text-fg-secondary">
            {challengeId === null
              ? 'Use the work address your administrator invited.'
              : `We sent a six-digit code to ${email}.`}
          </p>
        </div>

        {challengeId === null ? (
          <>
            <Field label="Work email" htmlFor="email">
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => { setEmail(event.target.value); }}
                className="h-10 w-full rounded-md border border-line bg-surface px-3 text-[15px]"
              />
            </Field>

            <Field label="Password" htmlFor="password">
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => { setPassword(event.target.value); }}
                className="h-10 w-full rounded-md border border-line bg-surface px-3 text-[15px]"
              />
            </Field>
          </>
        ) : (
          <Field label="Verification code" htmlFor="code">
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(event) => { setCode(event.target.value.replace(/\D/g, '')); }}
              className="tabular h-12 w-full rounded-md border border-line bg-surface px-3 text-center text-[24px] tracking-[0.4em]"
            />
          </Field>
        )}

        {active.error !== null ? <ErrorNotice error={active.error} /> : null}

        <Button type="submit" size="lg" loading={active.isPending} className="w-full">
          {challengeId === null ? 'Sign in' : 'Verify'}
        </Button>

        {/* The way back in for a traveller whose password will not work. Without it the
            console has exactly one credential and no recovery, and the person locked out
            is a customer's employee who cannot get to a meeting. */}
        {challengeId === null ? (
          <button
            type="button"
            onClick={useCodeInstead}
            disabled={email.length === 0 || requestCode.isPending}
            className="w-full text-center text-[13px] text-fg-brand hover:underline disabled:opacity-50"
          >
            {email.length === 0 ? 'Enter your email to get a code instead' : 'Email me a code instead'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { setChallengeId(null); setCode('') }}
            className="w-full text-center text-[13px] text-fg-tertiary hover:text-fg"
          >
            Use a password instead
          </button>
        )}

      </form>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  readonly label: string
  readonly htmlFor: string
  readonly children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-fg-secondary">
        {label}
      </label>
      {children}
    </div>
  )
}

/**
 * Shows why a sign-in failed.
 *
 * Wrong password and unknown account produce the same message on purpose — the identity
 * service returns the same code for both, and distinguishing them here would hand an
 * attacker a way to enumerate which work addresses exist.
 */
function ErrorNotice({ error }: { readonly error: Error }) {
  const message =
    error instanceof ApiError && error.code === 'auth.account_locked'
      ? 'This account is locked. Your administrator can unlock it.'
      : error instanceof ApiError && error.status === 401
        ? 'That email and password do not match.'
        : 'Something went wrong. Please try again.'

  return (
    <p role="alert" className="rounded-md bg-danger-subtle px-3 py-2 text-[13px] text-fg-danger">
      {message}
    </p>
  )
}
