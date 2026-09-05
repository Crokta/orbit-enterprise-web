import { type ReactNode } from 'react'

import { cn } from './cn'

/** A bordered surface with an optional heading, the building block of every page. */
export function Card({
  title,
  subtitle,
  action,
  children,
  className,
  padded = true,
}: {
  readonly title?: string
  readonly subtitle?: ReactNode
  readonly action?: ReactNode
  readonly children: ReactNode
  readonly className?: string
  readonly padded?: boolean
}) {
  return (
    <section className={cn('rounded-xl border border-line-subtle bg-surface shadow-[var(--shadow-e1)]', padded && 'p-4', className)}>
      {(title !== undefined || action !== undefined) && (
        <header className={cn('flex items-start justify-between gap-4', padded ? 'mb-3' : 'p-4 pb-3')}>
          <div>
            {title !== undefined && <h2 className="text-[15px] font-semibold leading-5">{title}</h2>}
            {subtitle !== undefined && <p className="text-[12px] text-fg-tertiary">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

/** A label/value row, as the summary panels use: "Fare estimate · ₦12,400". */
export function DefinitionRow({
  label,
  value,
  tone = 'neutral',
  mono = false,
}: {
  readonly label: string
  readonly value: ReactNode
  readonly tone?: 'neutral' | 'warning' | 'danger' | 'success' | 'brand'
  readonly mono?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line-subtle py-2.5 last:border-0">
      <dt className="text-[13px] text-fg-secondary">{label}</dt>
      <dd
        className={cn(
          'text-right text-[13px] font-medium',
          mono && 'font-mono tabular',
          tone === 'warning' && 'text-fg-warning',
          tone === 'danger' && 'text-fg-danger',
          tone === 'success' && 'text-fg-success',
          tone === 'brand' && 'text-fg-brand',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

/** A friendly empty state inside a card or table. */
export function EmptyState({ title, children }: { readonly title: string; readonly children?: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-[14px] font-medium text-fg">{title}</p>
      {children !== undefined && <p className="mt-1 text-[13px] text-fg-tertiary">{children}</p>}
    </div>
  )
}
