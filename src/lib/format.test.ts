import { describe, expect, it } from 'vitest'

import { formatMoney, formatPeriod, formatWhen, humanise, initials, percentChange } from './format'

describe('format', () => {
  it('formats money without kobo unless asked', () => {
    expect(formatMoney(765_000, 'NGN')).toBe('₦7,650')
    expect(formatMoney(765_050, 'NGN', { fraction: true })).toBe('₦7,650.50')
    expect(formatMoney(482_000_000, 'NGN', { compact: true })).toBe('₦4.82M')
    expect(formatMoney(48_200, 'NGN', { compact: true })).toBe('₦482')
  })

  it('takes initials from a name or an address', () => {
    expect(initials('Daniel Ale')).toBe('DA')
    expect(initials('ada.n@kolomoni.ng')).toBe('AN')
    expect(initials('chidinma')).toBe('CH')
  })

  it('describes a change against last month', () => {
    expect(percentChange(1284, 1142)).toBeCloseTo(12.43, 1)
    // Nothing last month means there is nothing to compare to, not infinite growth.
    expect(percentChange(10, 0)).toBeNull()
  })

  it('names the day relative to now', () => {
    const now = new Date(2026, 8, 3, 16, 0)

    expect(formatWhen(new Date(2026, 8, 3, 15, 40), now)).toBe('Today 15:40')
    expect(formatWhen(new Date(2026, 8, 2, 17, 40), now)).toBe('Yesterday 17:40')
    expect(formatWhen(new Date(2026, 8, 1, 6, 20), now)).toBe('1 Sep 06:20')
  })

  it('spells out a billing period', () => {
    expect(formatPeriod('2026-08', new Date(Date.UTC(2026, 8, 3)))).toBe('1–31 August 2026')
    expect(formatPeriod('2026-09', new Date(Date.UTC(2026, 8, 3)))).toBe('1–3 September 2026')
  })

  it('humanises enum values', () => {
    expect(humanise('TravelAdmin')).toBe('Travel admin')
    expect(humanise('AwaitingApproval')).toBe('Awaiting approval')
    expect(humanise('over_approval_threshold')).toBe('Over approval threshold')
  })
})
