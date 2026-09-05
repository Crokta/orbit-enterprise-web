import { type ReactNode } from 'react'

import { Icon, type IconName } from './Icon'
import { cn } from './cn'

export type BannerTone = 'info' | 'warning' | 'danger' | 'success'

const TONES: Record<BannerTone, { readonly box: string; readonly icon: IconName }> = {
  info: { box: 'border-line-brand/40 bg-brand-subtle text-fg-brand', icon: 'shield-check' },
  warning: { box: 'border-[color:var(--border-warning)]/50 bg-warning-subtle text-fg-warning', icon: 'warning' },
  danger: { box: 'border-[color:var(--border-danger)]/60 bg-danger-subtle text-fg-danger', icon: 'warning' },
  success: { box: 'border-[color:var(--border-success)]/50 bg-success-subtle text-fg-success', icon: 'check-circle' },
}

/** A full-width notice above a page's content, with an optional action on the right. */
export function Banner({
  tone,
  title,
  children,
  action,
  className,
}: {
  readonly tone: BannerTone
  readonly title?: string
  readonly children?: ReactNode
  readonly action?: ReactNode
  readonly className?: string
}) {
  const style = TONES[tone]

  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex items-center gap-3 rounded-lg border px-4 py-3', style.box, className)}>
      <Icon name={style.icon} size={20} className="shrink-0" />
      <div className="min-w-0 flex-1">
        {title !== undefined && <p className="text-[14px] font-semibold leading-5">{title}</p>}
        {children !== undefined && <div className={cn('text-[13px] leading-[18px]', title !== undefined && 'opacity-90')}>{children}</div>}
      </div>
      {action}
    </div>
  )
}
