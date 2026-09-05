import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { Avatar } from '../components/ui/Avatar'
import { Icon, type IconName } from '../components/ui/Icon'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { cn } from '../components/ui/cn'
import { LoadError } from '../components/ui/LoadError'
import { ROLE_LABELS, canManageBilling, canManageTravel, displayName, enterprise, isAdmin, type Me } from '../lib/api/enterprise'
import { clearSession } from '../lib/auth/session'
import { queryKeys } from '../lib/query/client'
import { useMe } from '../features/session/useMe'

interface NavItem {
  readonly to: string
  readonly label: string
  readonly icon: IconName
  /** Marks the item active for any path beneath it, not only an exact match. */
  readonly prefix?: boolean
  readonly badge?: 'approvals'
}

/**
 * What each role sees in the sidebar.
 *
 * A member gets the employee console: book, own trips, own expenses, own policy. An admin
 * gets the management console, trimmed to what their role can open — a billing admin has
 * no Trips or Employees, because those pages show rider names and routes.
 */
function navigationFor(me: Me): readonly NavItem[] {
  if (!isAdmin(me.role)) {
    return [
      { to: '/book', label: 'Book a ride', icon: 'car' },
      { to: '/my-trips', label: 'My trips', icon: 'clock', prefix: true },
      { to: '/my-expenses', label: 'My expenses', icon: 'receipt' },
      { to: '/policy', label: 'Policy', icon: 'shield' },
    ]
  }

  const travel = canManageTravel(me.role)
  const billing = canManageBilling(me.role)

  return [
    { to: '/dashboard', label: 'Dashboard', icon: 'home' },
    ...(travel ? [{ to: '/trips', label: 'Trips', icon: 'car' } as const] : []),
    ...(travel ? [{ to: '/employees', label: 'Employees', icon: 'users' } as const] : []),
    ...(travel ? [{ to: '/policies', label: 'Policies', icon: 'shield' } as const] : []),
    { to: '/cost-centres', label: 'Cost centres', icon: 'briefcase' },
    ...(billing ? [{ to: '/invoices', label: 'Invoices', icon: 'file' } as const] : []),
    ...(travel || me.isApprover ? [{ to: '/approvals', label: 'Approvals', icon: 'check', badge: 'approvals' } as const] : []),
    ...(me.role === 'Owner' ? [{ to: '/settings', label: 'Settings', icon: 'settings', prefix: true } as const] : []),
  ]
}

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
  const me = useMe()

  const approvals = useQuery({
    queryKey: queryKeys.approvals.queue(),
    queryFn: enterprise.approvals.queue,
    enabled: me.data?.isApprover === true,
    refetchInterval: 60_000,
  })

  function signOut() {
    clearSession()
    void navigate({ to: '/sign-in' })
  }

  const items = me.data === undefined ? [] : navigationFor(me.data)

  return (
    <div className="flex min-h-screen bg-canvas">
      <nav aria-label="Main" className="flex w-[248px] shrink-0 flex-col border-r border-line-subtle bg-surface">
        {/* The same mark as the sign-in page, the operations console and the public site.
            A different logo per surface reads as a different product. */}
        <div className="flex h-[76px] shrink-0 items-center gap-3 px-5">
          <span className="grid size-8 place-items-center rounded-lg bg-brand text-[14px] font-bold text-fg-on-brand">O</span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-5">Orbit Business</p>
            <p className="truncate text-[12px] text-fg-tertiary">
              {me.data === undefined ? '…' : isAdmin(me.data.role) ? me.data.company.name : `${me.data.company.name} · employee`}
            </p>
          </div>
        </div>

        <ul className="flex-1 space-y-0.5 px-3">
          {items.map((item) => {
            const active = item.prefix === true ? pathname.startsWith(item.to) : pathname === item.to
            const count = item.badge === 'approvals' ? (approvals.data?.length ?? 0) : 0

            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    'flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-medium transition-colors',
                    active ? 'bg-brand-subtle text-fg-brand' : 'text-fg-secondary hover:bg-hover hover:text-fg',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon name={item.icon} size={20} className={active ? 'text-fg-brand' : 'text-fg-tertiary'} />
                  <span className="flex-1">{item.label}</span>
                  {count > 0 && <span className="tabular text-[12px] font-semibold text-fg-brand">{count}</span>}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Who is signed in, and the way out. */}
        <div className="shrink-0 border-t border-line-subtle p-3">
          {me.data !== undefined && (
            <div className="flex items-center gap-3 px-2 py-2">
              <Avatar name={displayName(me.data)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium leading-5">{displayName(me.data)}</p>
                <p className="truncate text-[12px] text-fg-tertiary">
                  {isAdmin(me.data.role)
                    ? ROLE_LABELS[me.data.role]
                    : [me.data.costCentreName, me.data.costCentreCode].filter((part) => part !== null).join(' · ') || 'Employee'}
                </p>
              </div>
            </div>
          )}

          <div className="mt-1 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium text-fg-secondary transition-colors hover:bg-hover hover:text-fg"
            >
              <Icon name="logout" size={16} />
              Sign out
            </button>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* min-w-0 on both this and the flex parent. Without it a wide table forces the
            whole layout wider instead of scrolling inside its own container, and the
            sidebar slides off the screen. */}
        <main className="min-w-0 flex-1 overflow-auto px-8 py-6">
          {me.isError ? (
            <LoadError error={me.error} what="your account" onRetry={() => { void me.refetch() }} />
          ) : me.isPending ? (
            <p className="text-[13px] text-fg-tertiary">Loading your account…</p>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  )
}
