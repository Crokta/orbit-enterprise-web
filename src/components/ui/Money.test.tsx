import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Money } from './Money'

describe('Money', () => {
  it('divides minor units at the last moment', () => {
    render(<Money minorUnits={1_240_000} currency="NGN" />)

    // Whole naira by default: every fare in the design is shown without kobo.
    expect(screen.getByText('₦12,400')).toBeInTheDocument()
  })

  it('shows kobo when asked', () => {
    render(<Money minorUnits={123_456} currency="NGN" fraction />)

    expect(screen.getByText('₦1,234.56')).toBeInTheDocument()
  })

  it('compacts millions for the tiles', () => {
    render(<Money minorUnits={482_000_000} currency="NGN" compact />)

    expect(screen.getByText('₦4.82M')).toBeInTheDocument()
  })
})
