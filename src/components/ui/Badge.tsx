import { type ReactNode } from 'react'

import { cn } from './cn'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'brand' | 'info'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-subtle text-fg-secondary',
  success: 'bg-success-subtle text-fg-success',
  warning: 'bg-warning-subtle text-fg-warning',
  danger: 'bg-danger-subtle text-fg-danger',
  brand: 'bg-brand-subtle text-fg-brand',
  info: 'bg-subtle text-fg',
}

/**
 * A small rectangular label: "Live", "Breach", "87% used", "Yes".
 *
 * Distinct from the status pill, which carries a dot and names a lifecycle state. A badge
 * is a fact about the row — an environment, a percentage, a yes or no.
 */
export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  readonly tone?: BadgeTone
  readonly children: ReactNode
  readonly className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[11px] font-semibold leading-4',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
