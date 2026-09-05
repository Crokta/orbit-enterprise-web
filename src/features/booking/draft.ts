import { type Place } from '../../lib/geocode'
import { type QuoteOption } from '../../lib/api/enterprise'

/**
 * The booking in progress, shared between "Book a ride" and "Choose a ride".
 *
 * Kept in session storage rather than the URL: a quote token and two addresses do not
 * belong in a link someone might paste into a chat, and they should survive a reload
 * of the choose-a-ride page without surviving the tab being closed.
 */
export interface BookingDraft {
  readonly pickup: Place
  readonly dropoff: Place
  readonly date: string
  readonly time: string
  readonly costCentre: string | null
  readonly projectCode: string
  readonly reason: string
  readonly bookingFor: 'me' | 'colleague' | 'visitor'
  readonly passenger: string
  readonly options: readonly QuoteOption[]
}

const KEY = 'orbit-booking-draft'

export function saveDraft(draft: BookingDraft): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft))
  } catch {
    // Storage disabled. The draft still lives in memory for this navigation.
  }
}

export function loadDraft(): BookingDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw === null ? null : (JSON.parse(raw) as BookingDraft)
  } catch {
    return null
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}
