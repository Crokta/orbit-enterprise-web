import { initials } from '../../lib/format'
import { cn } from './cn'

/** Initials in a circle. The console has no photos, and a grey circle is not a person. */
export function Avatar({
  name,
  size = 'md',
  className,
}: {
  readonly name: string
  readonly size?: 'sm' | 'md' | 'lg'
  readonly className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full bg-subtle font-semibold text-fg-secondary',
        size === 'sm' && 'size-7 text-[11px]',
        size === 'md' && 'size-9 text-[12px]',
        size === 'lg' && 'size-11 text-[14px]',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
