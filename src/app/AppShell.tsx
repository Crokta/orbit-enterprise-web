import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'

import { ThemeToggle } from '../components/ui/ThemeToggle'
import { cn } from '../components/ui/cn'
import { clearSession, getAccessToken } from '../lib/auth/session'

const NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/book', label: 'Book a ride' },
  { to: '/trips', label: 'Trip log' },
  { to: '/employees', label: 'Employees' },
  { to: '/approvals', label: 'Approvals' },
  { to: '/policies', label: 'Ride policies' },
  { to: '/cost-centres', label: 'Cost centres' },
  { to: '/invoices', label: 'Invoices' },
] as const

/**
 * The frame every authenticated page sits in.
 *
 * A persistent sidebar rather than a router-driven layout per page, so navigating does
 * not unmount and remount the navigation. Rebuilding the chrome on every route change
 * is both slower and visibly flickery on a slow connection.
 */
export function AppShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const navigate = useNavigate()
  const identity = readSubject()

  function signOut() {
    clearSession()
    void navigate({ to: '/' })
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <nav
        aria-label="Main"
        className="flex w-60 shrink-0 flex-col border-r border-line-subtle bg-surface"
      >
        {/* The same mark as the sign-in page, the operations console and the public site.
            A different logo per surface reads as a different product. */}
        <div className="flex h-14 shrink-0 items-center gap-2.5 px-4">
          <span className="grid size-7 place-items-center rounded-md bg-brand text-[13px] font-semibold text-fg-on-brand">
            O
          </span>
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Orbit for Business</span>
        </div>

        <ul className="flex-1 space-y-0.5 px-2 py-2">
          {NAV.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  'block rounded-md px-3 py-2 text-[13px] font-medium transition-colors',
                  pathname === item.to
                    ? 'bg-brand-subtle text-fg-brand'
                    : 'text-fg-secondary hover:bg-hover hover:text-fg',
                )}
                // The router sets aria-current itself for the active link, but only
                // for exact matches; setting it here keeps it correct for the index
                // route, which would otherwise match everything.
                aria-current={pathname === item.to ? 'page' : undefined}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Who is signed in, and the way out. Neither existed: a console that bills a
            company for its employees' travel never showed whose account was doing it, and
            there was no sign-out anywhere in the application. */}
        <div className="shrink-0 border-t border-line-subtle p-3">
          {identity !== null && (
            <p className="mb-2 truncate px-1 text-[11px] text-fg-tertiary" title={identity}>
              {identity}
            </p>
          )}

          <button
            type="button"
            onClick={signOut}
            className="w-full rounded-md px-1 py-1.5 text-left text-[12px] font-medium text-fg-secondary transition-colors hover:bg-hover hover:text-fg"
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-end gap-3 border-b border-line-subtle bg-surface px-6">
          <ThemeToggle />
        </header>

        {/* min-w-0 on both this and the flex parent. Without it a wide table forces the
            whole layout wider instead of scrolling inside its own container, and the
            sidebar slides off the screen. */}
        <main className="min-w-0 flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/**
 * The subject the access token carries.
 *
 * Read from the token rather than held in state, so it cannot disagree with the credential
 * actually being sent. The token has no email on it, so this is an account id — enough to
 * tell two sessions apart, which is what it is for.
 */
function readSubject(): string | null {
  const token = getAccessToken()

  if (token === null) {
    return null
  }

  try {
    const payload = token.split('.')[1]

    if (payload === undefined) {
      return null
    }

    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=')
    const claims = JSON.parse(atob(padded.replaceAll('-', '+').replaceAll('_', '/'))) as Record<string, unknown>
    const subject = claims['sub']

    return typeof subject === 'string' ? subject : null
  } catch {
    // A malformed token is not worth breaking the shell over: the next API call rejects it
    // and lands the user on sign-in with a real message.
    return null
  }
}
