import { cn } from './cn'

/** The ride, employee, invoice and approval states the console displays. */
export type Status =
  | 'online'
  | 'offline'
  | 'in-trip'
  | 'cancelled'
  | 'arrears'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'invited'
  | 'suspended'
  | 'completed'
  | 'settling'
  | 'paid'
  | 'overdue'
  | 'due'
  | 'accruing'
  | 'awaiting'
  | 'declined'
  | 'expired'
  | 'withdrawn'
  | 'voided'

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
  completed: 'bg-success-subtle text-fg-success',
  settling: 'bg-warning-subtle text-fg-warning',
  paid: 'bg-success-subtle text-fg-success',
  overdue: 'bg-danger-subtle text-fg-danger',
  due: 'bg-subtle text-fg-secondary',
  accruing: 'bg-subtle text-fg-secondary',
  awaiting: 'bg-warning-subtle text-fg-warning',
  declined: 'bg-danger-subtle text-fg-danger',
  expired: 'bg-subtle text-fg-tertiary',
  withdrawn: 'bg-subtle text-fg-tertiary',
  voided: 'bg-subtle text-fg-tertiary',
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
  completed: 'Completed',
  settling: 'Settling',
  paid: 'Paid',
  overdue: 'Overdue',
  due: 'Due',
  accruing: 'Accruing',
  awaiting: 'Awaiting approval',
  declined: 'Declined',
  expired: 'Expired',
  withdrawn: 'Withdrawn',
  voided: 'Voided',
}

export function StatusPill({
  status,
  label,
  className,
}: {
  readonly status: Status
  /** Overrides the default wording, e.g. "Declined — use Comfort". */
  readonly label?: string | undefined
  readonly className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap',
        STYLES[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label ?? LABELS[status]}
    </span>
  )
}
