import { Link, Outlet, useRouterState } from '@tanstack/react-router'

import { cn } from '../../components/ui/cn'

const TABS = [
  { to: '/settings/api-keys', label: 'API keys' },
  { to: '/settings/security', label: 'SSO & security' },
  { to: '/settings/admins', label: 'Admin users' },
] as const

/** The owner's settings area: three pages under one sidebar entry. */
export function SettingsLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <div className="space-y-5">
      <nav aria-label="Settings" className="-mt-1 flex gap-1 border-b border-line-subtle">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.to)

          return (
            <Link
              key={tab.to}
              to={tab.to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                '-mb-px border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors',
                active ? 'border-[var(--border-brand)] text-fg-brand' : 'border-transparent text-fg-secondary hover:text-fg',
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
      <Outlet />
    </div>
  )
}
