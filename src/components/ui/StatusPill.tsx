import { cn } from './cn'

/** The ride and driver states the console displays. */
export type Status =
  | 'online'
  | 'offline'
  | 'in-trip'
  | 'cancelled'
  | 'arrears'
  | 'pending'
  | 'approved'
  | 'rejected'

  // The employee lifecycle. These were missing, so the employees table rendered a pill
  // with no style and no label — a blank cell where the account's state should be. It
  // type-checked because the page declared a union that did not describe what the service
  // actually sends.
  | 'active'
  | 'invited'
  | 'suspended'

const STYLES: Record<Status, string> = {
  // Straight off the Figma status ramp. Colour is never the only signal — each pill
  // also carries its label — because roughly one in twelve men cannot reliably tell
  // the green from the amber.
  online: 'bg-success-subtle text-fg-success',
  offline: 'bg-subtle text-fg-tertiary',
  'in-trip': 'bg-brand-subtle text-fg-brand',
  cancelled: 'bg-danger-subtle text-fg-danger',
  arrears: 'bg-warning-subtle text-fg-warning',
  pending: 'bg-warning-subtle text-fg-warning',
  approved: 'bg-success-subtle text-fg-success',
  rejected: 'bg-danger-subtle text-fg-danger',
  active: 'bg-success-subtle text-fg-success',
  invited: 'bg-warning-subtle text-fg-warning',
  suspended: 'bg-danger-subtle text-fg-danger',
}

const LABELS: Record<Status, string> = {
  online: 'Online',
  offline: 'Offline',
  'in-trip': 'In trip',
  cancelled: 'Cancelled',
  arrears: 'In arrears',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  active: 'Active',
  invited: 'Invited',
  suspended: 'Suspended',
}

export function StatusPill({ status, className }: { readonly status: Status; readonly className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
        STYLES[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {LABELS[status]}
    </span>
  )
}
