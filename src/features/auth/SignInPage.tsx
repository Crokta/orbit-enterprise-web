import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type SyntheticEvent, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { cn } from '../../components/ui/cn'
import { api } from '../../lib/api/client'
import { ApiError } from '../../lib/api/problem'
import { setSession } from '../../lib/auth/session'

interface TokenPair {
  readonly accessToken: string
  readonly expiresInSeconds: number
  readonly mustChangePassword?: boolean
}

/**
 * Enterprise sign-in.
 *
 * Email and password against identity's own endpoint.
 *
 * There was an emailed-code path here and it has been removed: one-time codes belong to
 * the mobile apps, where a phone number is the account and a code is the only credential
 * a rider has. A travel manager at a desk has a password manager, and a second credential
 * on this screen was a second thing to keep working for no benefit either way.
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

  const signIn = useMutation({
    mutationFn: (): Promise<TokenPair> =>
      api.post<TokenPair>('/v1/auth/password', { json: { email, password } }),
    onSuccess: (result) => {
      setSession(result.accessToken, result.expiresInSeconds)
      goBackToWhereTheyWere()
    },
  })

  /**
   * Returns the user to the page they were trying to reach.
   *
   * As `href`, not `to`. The redirect target arrives from the URL, so it is an
   * arbitrary string rather than one of the router's known route paths — and treating
   * an arbitrary string as a typed route is how a bad link becomes a runtime error
   * instead of a 404.
   */
  function goBackToWhereTheyWere() {
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
    signIn.mutate()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-line-subtle bg-surface p-6 shadow-[var(--shadow-e2)]"
      >
        <div className="space-y-1">
          <div className="size-8 rounded-full bg-brand" aria-hidden="true" />
          <h1 className="text-[24px] font-semibold leading-[30px]">Sign in to Orbit for Business</h1>
          <p className="text-[13px] text-fg-secondary">
            Use the work address your administrator invited.
          </p>
        </div>

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
          <PasswordInput id="password" value={password} onChange={setPassword} />
        </Field>

        {signIn.error !== null ? <ErrorNotice error={signIn.error} /> : null}

        <Button type="submit" size="lg" loading={signIn.isPending} className="w-full">
          Sign in
        </Button>

        <p className="text-center text-[12px] text-fg-tertiary">
          Trouble signing in? Your administrator can reset your password.
        </p>
      </form>
    </div>
  )
}

/**
 * A password input with a reveal toggle.
 *
 * A password field is the one place a typo is invisible, and the cost of that typo is a
 * failed attempt against a lockout counter. Being able to look at what was typed is worth
 * more than hiding it from a shoulder that is rarely there.
 */
function PasswordInput({
  id,
  value,
  onChange,
}: {
  readonly id: string
  readonly value: string
  readonly onChange: (value: string) => void
}) {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="relative">
      <input
        id={id}
        type={revealed ? 'text' : 'password'}
        autoComplete="current-password"
        required
        value={value}
        onChange={(event) => { onChange(event.target.value); }}
        className="h-10 w-full rounded-md border border-line bg-surface px-3 pr-10 text-[15px]"
      />

      <button
        type="button"
        onClick={() => { setRevealed((current) => !current) }}
        // The label states what the control will do next, and it changes. That is the
        // whole message a screen reader needs; aria-pressed on top of it says the same
        // thing twice and disagrees about which state is "on".
        aria-label={revealed ? 'Hide password' : 'Show password'}
        aria-controls={id}
        // Out of the tab order deliberately: someone typing a password and pressing Tab
        // expects the submit button, not a control they did not ask for. Still reachable
        // by click, and by shift-tabbing back.
        tabIndex={-1}
        className={cn(
          'absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-md',
          'text-fg-tertiary transition-colors hover:text-fg',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bg-brand)]/40',
        )}
      >
        <EyeIcon closed={revealed} />
      </button>
    </div>
  )
}

/** Open eye when the password is hidden; struck through when it is showing. */
function EyeIcon({ closed }: { readonly closed: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="size-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1.8 10S4.9 4.6 10 4.6 18.2 10 18.2 10 15.1 15.4 10 15.4 1.8 10 1.8 10Z" />
      <circle cx="10" cy="10" r="2.4" />
      {closed && <path d="m3 17 14-14" />}
    </svg>
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
