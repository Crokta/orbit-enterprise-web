import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type SyntheticEvent, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { Field, TextInput } from '../../components/ui/Inputs'
import { cn } from '../../components/ui/cn'
import { api } from '../../lib/api/client'
import { ApiError } from '../../lib/api/problem'
import { deviceFingerprint, setSession } from '../../lib/auth/session'

interface TokenPair {
  readonly accessToken: string
  readonly refreshToken: string
  readonly familyId: string
  readonly expiresInSeconds: number
  readonly mustChangePassword?: boolean
}

/**
 * Enterprise sign-in.
 *
 * Work email and password against identity's own endpoint. Single sign-on is not yet on
 * the platform, so there is no "Continue with your identity provider" — a button that
 * routes nowhere is worse than none.
 *
 * The password is never stored, never logged and never put in a query string — the last
 * of those is worth stating because a form that GETs instead of POSTs writes credentials
 * into every proxy log between here and the gateway.
 */
export function SignInPage() {
  const navigate = useNavigate()

  const [step, setStep] = useState<'credentials' | 'change'>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const signIn = useMutation({
    mutationFn: (): Promise<TokenPair> =>
      // The fingerprint binds the refresh token to this browser; refresh without it is refused.
      api.post<TokenPair>('/v1/auth/password', { json: { email, password, deviceFingerprint: deviceFingerprint() } }),
    onSuccess: (result) => {
      setSession(result.accessToken, result.expiresInSeconds, { refreshToken: result.refreshToken, familyId: result.familyId })

      // The password from the invitation email gets one destination: the change screen.
      // Letting an administrator postpone it is how a temporary password emailed in
      // plaintext becomes the permanent credential on a company's account.
      if (result.mustChangePassword === true) {
        setStep('change')
        return
      }

      goBackToWhereTheyWere()
    },
  })

  const changePassword = useMutation({
    mutationFn: () =>
      api.post('/v1/account/credentials', { json: { currentPassword: password, newPassword } }),
    onSuccess: goBackToWhereTheyWere,
  })

  /**
   * Returns the user to the page they were trying to reach.
   *
   * As `href`, not `to`. The redirect target arrives from the URL, so it is an
   * arbitrary string rather than one of the router's known route paths.
   */
  function goBackToWhereTheyWere() {
    const target = new URLSearchParams(window.location.search).get('redirect')

    // Same-origin only, and the `//` check matters: `//evil.example` is a
    // protocol-relative URL, not a path. Without it the sign-in page is an open redirect.
    void (target !== null && target.startsWith('/') && !target.startsWith('//')
      ? navigate({ href: target })
      : navigate({ to: '/' }))
  }

  function onSubmit(event: SyntheticEvent) {
    event.preventDefault()

    if (step === 'credentials') {
      signIn.mutate()
      return
    }

    changePassword.mutate()
  }

  const locked = signIn.error instanceof ApiError && signIn.error.code === 'auth.credentials_locked'

  const active = step === 'credentials' ? signIn : changePassword

  // Identity's own floor is twelve characters; saying so here beats a round trip that
  // comes back with a rule the person could have been told before they typed.
  const mismatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword !== confirmPassword
  const tooShort = newPassword.length > 0 && newPassword.length < 12

  const blocked =
    step === 'change' && (mismatch || tooShort || newPassword.length === 0 || confirmPassword.length === 0)

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-[440px] rounded-2xl border border-line-subtle bg-surface p-8 shadow-[var(--shadow-e2)]">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-brand text-[15px] font-bold text-fg-on-brand">O</span>
          <div>
            <p className="text-[15px] font-semibold leading-5">Orbit Business</p>
            <p className="text-[12px] text-fg-tertiary">Corporate travel console</p>
          </div>
        </div>

        {locked ? (
          <LockedCard email={email} onRetry={() => { signIn.reset(); }} />
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-5">
            {step === 'credentials' ? (
              <>
                <div>
                  <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.01em]">Sign in</h1>
                  <p className="mt-2 text-[14px] text-fg-secondary">Use the work address your administrator invited.</p>
                </div>

                <Field label="Work email" htmlFor="email" hint="We'll match it to your company account.">
                  <TextInput
                    id="email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    placeholder="you@company.com"
                    onChange={(event) => { setEmail(event.target.value); }}
                  />
                </Field>

                <Field label="Password" htmlFor="password">
                  <PasswordInput id="password" value={password} onChange={setPassword} />
                </Field>
              </>
            ) : (
              <>
                <div>
                  <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.01em]">Choose a password</h1>
                  <p className="mt-2 text-[14px] text-fg-secondary">
                    The password from your invitation was temporary. Set your own to finish signing in.
                  </p>
                </div>

                <Field label="New password" htmlFor="new-password" hint="At least 12 characters.">
                  <PasswordInput id="new-password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
                </Field>

                <Field label="Confirm password" htmlFor="confirm-password">
                  <PasswordInput id="confirm-password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
                </Field>

                {mismatch ? (
                  <p role="alert" className="rounded-md bg-danger-subtle px-3 py-2 text-[13px] text-fg-danger">
                    The two passwords do not match.
                  </p>
                ) : null}
              </>
            )}

            {active.error !== null ? <ErrorNotice error={active.error} /> : null}

            <Button type="submit" size="lg" loading={active.isPending} disabled={blocked} className="w-full">
              {step === 'credentials' ? 'Continue' : 'Set password and continue'}
            </Button>

            {step === 'credentials' ? (
              <p className="text-center text-[12px] text-fg-tertiary">Can't sign in? Contact your travel admin.</p>
            ) : null}
          </form>
        )}
      </div>
    </div>
  )
}

/**
 * Sign-in locked.
 *
 * Identity locks a credential after five failed attempts and says only that it is locked,
 * not for how long — so the card explains the rule rather than inventing a countdown.
 */
function LockedCard({ email, onRetry }: { readonly email: string; readonly onRetry: () => void }) {
  return (
    <div className="mt-6 space-y-5">
      <span className="grid size-12 place-items-center rounded-full bg-danger-subtle text-fg-danger">
        <Icon name="lock" size={22} />
      </span>
      <div>
        <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.01em]">Sign-in locked</h1>
        <p className="mt-2 text-[14px] text-fg-secondary">
          Too many failed attempts on {email}. Sign-in is locked for 15 minutes.
        </p>
      </div>

      <dl className="divide-y divide-line-subtle border-y border-line-subtle text-[13px]">
        <div className="flex justify-between py-2.5"><dt className="text-fg-secondary">Locked at</dt><dd className="font-mono">{new Date().toLocaleTimeString('en-GB')}</dd></div>
        <div className="flex justify-between py-2.5"><dt className="text-fg-secondary">Unlocks</dt><dd className="font-mono">in 15 minutes</dd></div>
        <div className="flex justify-between py-2.5"><dt className="text-fg-secondary">Your administrator</dt><dd>Can unlock it sooner</dd></div>
      </dl>

      <Button variant="secondary" size="lg" className="w-full" onClick={onRetry}>Back to sign in</Button>

      <p className="text-center text-[12px] text-fg-danger">If this wasn't you, tell your travel admin — someone may be trying your password.</p>
    </div>
  )
}

/** A password input with a reveal toggle. */
function PasswordInput({
  id,
  value,
  onChange,
  autoComplete = 'current-password',
}: {
  readonly id: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly autoComplete?: 'current-password' | 'new-password'
}) {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="relative">
      <TextInput
        id={id}
        type={revealed ? 'text' : 'password'}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(event) => { onChange(event.target.value); }}
        className="pr-10"
      />

      <button
        type="button"
        onClick={() => { setRevealed((current) => !current) }}
        aria-label={revealed ? 'Hide password' : 'Show password'}
        aria-controls={id}
        tabIndex={-1}
        className={cn(
          'absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-md',
          'text-fg-tertiary transition-colors hover:text-fg',
        )}
      >
        <EyeIcon closed={revealed} />
      </button>
    </div>
  )
}

function EyeIcon({ closed }: { readonly closed: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.8 10S4.9 4.6 10 4.6 18.2 10 18.2 10 15.1 15.4 10 15.4 1.8 10 1.8 10Z" />
      <circle cx="10" cy="10" r="2.4" />
      {closed && <path d="m3 17 14-14" />}
    </svg>
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
    error instanceof ApiError && error.status === 401
      ? 'That email and password do not match.'
      : error instanceof ApiError && error.status === 429
        ? 'Too many attempts. Wait a minute and try again.'
        : 'Something went wrong. Please try again.'

  return (
    <p role="alert" className="rounded-md bg-danger-subtle px-3 py-2 text-[13px] text-fg-danger">
      {message}
    </p>
  )
}
