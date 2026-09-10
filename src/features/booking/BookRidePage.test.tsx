import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type React from 'react'

import type { CostCentreOption, Me } from '../../lib/api/enterprise'
import { BookRidePage } from './BookRidePage'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { readonly children?: React.ReactNode }) => <a>{children}</a>,
}))
vi.mock('./PlaceSearch', () => ({ PlaceSearch: () => <div data-testid="place-search" /> }))
vi.mock('./draft', () => ({ loadDraft: () => null, saveDraft: vi.fn() }))

const mine = vi.fn<() => Promise<readonly CostCentreOption[]>>()
vi.mock('../../lib/api/enterprise', () => ({
  enterprise: { costCentres: { mine: () => mine() }, quote: vi.fn() },
  vehicleLabel: (v: string) => v,
}))

const me = {
  company: { companyId: 'co_1', name: 'Harbour Logistics', currency: 'NGN', canBook: true },
  role: 'Member',
  canBookForVisitors: false,
  costCentreCode: 'ENG',
  costCentreName: 'Engineering',
  policy: {
    policyId: 'pol_1',
    name: 'Standard travel',
    approvalThresholdMinor: 2_500_000,
    hardCapMinor: null,
    currency: 'NGN',
    allowedClasses: [],
    permittedFrom: null,
    permittedTo: null,
    requiresCostCentre: true,
    requiresApprovalForSurge: false,
    isActive: true,
    activeEmployees: 12,
  },
  tripsThisMonth: 0,
  spendThisMonthMinor: 0,
  policyBreachesThisMonth: 0,
  currency: 'NGN',
} as unknown as Me

vi.mock('../session/useMe', () => ({ useMe: () => ({ data: me, isPending: false, isError: false }) }))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <BookRidePage />
    </QueryClientProvider>,
  )
}

describe('BookRidePage cost centre selector', () => {
  beforeEach(() => {
    mine.mockReset()
  })

  it('lists the company cost centres a member may bill to, own centre first and preselected', async () => {
    mine.mockResolvedValue([
      { code: 'ENG', name: 'Engineering', isMine: true },
      { code: 'SAL', name: 'Sales', isMine: false },
      { code: 'OPS', name: 'Operations', isMine: false },
    ])

    renderPage()

    const select = screen.getByLabelText<HTMLSelectElement>('Cost centre')
    expect(select.value).toBe('')
    expect(select.options[0]?.text).toBe('Engineering · ENG (yours)')

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Sales · SAL' })).toBeInTheDocument()
    })
    expect(screen.getByRole('option', { name: 'Operations · OPS' })).toBeInTheDocument()

    // The member's own centre is the default option, not repeated further down.
    expect(screen.queryByRole('option', { name: 'Engineering · ENG' })).not.toBeInTheDocument()
    expect(screen.queryByText('Loading cost centres…')).not.toBeInTheDocument()
    expect(mine).toHaveBeenCalledTimes(1)
  })

  it('keeps the member booking against their own centre when the list cannot be loaded', async () => {
    mine.mockRejectedValue(new Error('offline'))

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Could not load the cost centres/)).toBeInTheDocument()
    })
    const select = screen.getByLabelText<HTMLSelectElement>('Cost centre')
    expect(select.options[0]?.text).toBe('Engineering · ENG (yours)')
  })
})
