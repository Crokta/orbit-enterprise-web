import { Link, Outlet, useRouterState } from '@tanstack/react-router'

import { ThemeToggle } from '../components/ui/ThemeToggle'
import { cn } from '../components/ui/cn'

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

  return (
    <div className="flex min-h-screen bg-canvas">
      <nav aria-label="Main" className="w-60 shrink-0 border-r border-line-subtle bg-surface">
        <div className="flex h-14 items-center gap-2 px-4">
          <div className="size-6 rounded-full bg-brand" aria-hidden="true" />
          <span className="text-[15px] font-semibold">Orbit for Business</span>
        </div>

        <ul className="space-y-0.5 px-2 py-2">
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
