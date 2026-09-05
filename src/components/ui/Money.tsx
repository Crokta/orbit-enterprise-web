import { formatMoney } from '../../lib/format'

/**
 * Renders an amount held in minor units.
 *
 * Minor units all the way from the ledger to this component, and the division happens
 * here — the last moment before a human reads it. Every earlier conversion to a float
 * is a rounding error waiting to be reconciled, and a ledger that disagrees with a
 * receipt by one kobo is a support ticket nobody can close.
 */
export function Money({
  minorUnits,
  currency,
  className,
  fraction = false,
  compact = false,
}: {
  readonly minorUnits: number
  readonly currency: string
  readonly className?: string
  /** Show kobo. Off by default: fares are whole naira on every screen in the design. */
  readonly fraction?: boolean
  /** "₦4.82M" for tiles with no room for eleven characters. */
  readonly compact?: boolean
}) {
  return (
    // Tabular figures, so a column of fares lines up. A finance screen where the digits
    // are proportionally spaced cannot be scanned, and scanning is the entire job.
    <span className={`font-mono tabular ${className ?? ''}`}>{formatMoney(minorUnits, currency, { fraction, compact })}</span>
  )
}
