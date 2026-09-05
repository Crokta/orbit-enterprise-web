/**
 * Formatting helpers shared by every screen.
 *
 * One place, so a fare on the dashboard and the same fare on the invoice are formatted by
 * the same code and cannot disagree about rounding or the currency symbol.
 */

/** Renders minor units as a currency string: 1234500 NGN → "₦12,345". */
export function formatMoney(
  minorUnits: number,
  currency: string,
  options: { readonly compact?: boolean; readonly fraction?: boolean } = {},
): string {
  const major = minorUnits / 100

  if (options.compact === true && Math.abs(major) >= 1_000_000) {
    // "₦4.82M" — the dashboard tiles have room for five characters, not eleven. The exact
    // figure is always one click away on the invoice.
    return `${symbol(currency)}${(major / 1_000_000).toFixed(2)}M`
  }

  const formatted = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: options.fraction === true ? 2 : 0,
    maximumFractionDigits: options.fraction === true ? 2 : 0,
  }).format(major)

  return formatted
}

function symbol(currency: string): string {
  const parts = new Intl.NumberFormat('en-NG', { style: 'currency', currency }).formatToParts(0)
  return parts.find((part) => part.type === 'currency')?.value ?? currency
}

/** "3 Sep 2026". */
export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    toDate(value),
  )
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** "3 Sep" — for tight table cells. Three letters always; Intl gives "Sept" in some locales. */
export function formatShortDate(value: string | Date): string {
  const date = toDate(value)
  return `${String(date.getDate())} ${MONTHS[date.getMonth()] ?? ''}`
}

/** "14:02". */
export function formatTime(value: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(
    toDate(value),
  )
}

/** "Today 15:40", "Yesterday 17:40", or "1 Sep 06:20". */
export function formatWhen(value: string | Date, now: Date = new Date()): string {
  const date = toDate(value)
  const day = startOfDay(date).getTime()
  const today = startOfDay(now).getTime()
  const oneDay = 86_400_000

  if (day === today) {
    return `Today ${formatTime(date)}`
  }

  if (day === today - oneDay) {
    return `Yesterday ${formatTime(date)}`
  }

  if (day === today + oneDay) {
    return `Tomorrow ${formatTime(date)}`
  }

  return `${formatShortDate(date)} ${formatTime(date)}`
}

/** "2 minutes ago", "Today 08:14", "Yesterday 17:02", "12 days ago". */
export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const date = toDate(value)
  const minutes = Math.round((now.getTime() - date.getTime()) / 60_000)

  if (minutes < 1) {
    return 'just now'
  }

  if (minutes < 60) {
    return `${String(minutes)} minute${minutes === 1 ? '' : 's'} ago`
  }

  const days = Math.floor((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000)

  if (days === 0) {
    return `Today ${formatTime(date)}`
  }

  if (days === 1) {
    return `Yesterday ${formatTime(date)}`
  }

  if (days < 30) {
    return `${String(days)} days ago`
  }

  return formatDate(date)
}

/** "waiting 41 min" — how long a request has stood. */
export function formatWaiting(since: string | Date, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - toDate(since).getTime()) / 60_000))

  if (minutes < 60) {
    return `${String(minutes)} min`
  }

  const hours = Math.floor(minutes / 60)
  return `${String(hours)} hr ${String(minutes % 60)} min`
}

/** "in 35 min" / "in 3 hr". */
export function formatUntil(value: string | Date, now: Date = new Date()): string {
  const minutes = Math.round((toDate(value).getTime() - now.getTime()) / 60_000)

  if (minutes <= 0) {
    return 'now'
  }

  if (minutes < 60) {
    return `in ${String(minutes)} min`
  }

  return `in ${String(Math.round(minutes / 60))} hr`
}

/** "1–3 September 2026" for the month to date, or "1–31 August 2026" for a period. */
export function formatPeriod(period: string, now: Date = new Date()): string {
  const [yearText, monthText] = period.split('-')
  const year = Number(yearText)
  const month = Number(monthText)

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return period
  }

  const first = new Date(Date.UTC(year, month - 1, 1))
  const isCurrent = now.getUTCFullYear() === year && now.getUTCMonth() === month - 1
  const last = isCurrent ? now.getUTCDate() : new Date(Date.UTC(year, month, 0)).getUTCDate()
  const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(first)

  return `1–${String(last)} ${monthName} ${String(year)}`
}

/** "September to date". */
export function monthToDateLabel(now: Date = new Date()): string {
  return `${new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(now)} to date`
}

/** "DA" for "Daniel Ale"; "AD" for "ada.n@kolomoni.ng". */
export function initials(name: string): string {
  const cleaned = name.split('@')[0] ?? name
  const parts = cleaned.split(/[\s._-]+/).filter((part) => part.length > 0)

  const first = parts[0]?.[0] ?? '?'
  const second = parts[1]?.[0] ?? cleaned[1] ?? ''

  return `${first}${second}`.toUpperCase()
}

/** "12.4%" from two figures, or null when there is nothing to compare against. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return null
  }

  return ((current - previous) / previous) * 100
}

/** Formats a number with thousands separators: 1284 → "1,284". */
export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-NG').format(value)
}

/** Title-cases an enum-style value: "TravelAdmin" → "Travel admin", "AwaitingApproval" → "Awaiting approval". */
export function humanise(value: string): string {
  const spaced = value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value)
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
