import { type ReactNode } from 'react'

import { NotificationBell } from './NotificationBell'

/**
 * The strip every page starts with: title, one-line context, and the actions.
 *
 * Title on the left, buttons on the right, bell between them — the same on every page, so
 * a travel manager's eye always lands on the primary action in the same place.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  readonly title: string
  readonly subtitle?: ReactNode
  readonly actions?: ReactNode
}) {
  return (
    <header className="-mx-8 -mt-6 mb-6 flex items-center justify-between gap-6 border-b border-line-subtle bg-surface px-8 py-4">
      <div className="min-w-0">
        <h1 className="truncate text-[24px] font-semibold leading-[30px] tracking-[-0.01em]">{title}</h1>
        {subtitle !== undefined && <p className="mt-0.5 text-[13px] text-fg-secondary">{subtitle}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <NotificationBell />
        {actions}
      </div>
    </header>
  )
}
