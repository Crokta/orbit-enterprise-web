import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { OnboardingEntryPage } from './OnboardingEntryPage'

const navigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  Link: ({ to, children }: { readonly to: string; readonly children: React.ReactNode }) => <a href={to}>{children}</a>,
}))

const post = vi.fn()
vi.mock('../../lib/api/client', () => ({
  api: { post: (...args: unknown[]) => post(...args) as unknown },
  newIdempotencyKey: () => 'key',
}))

const claim = vi.fn()
const selfServe = vi.fn()
vi.mock('./api', () => ({
  onboarding: {
    claim: (...args: unknown[]) => claim(...args) as unknown,
    selfServe: (...args: unknown[]) => selfServe(...args) as unknown,
  },
}))

vi.mock('../../lib/auth/session', () => ({
  deviceFingerprint: () => 'fp',
  isSessionValid: () => false,
  refreshAccessToken: () => Promise.resolve(false),
  setSession: vi.fn(),
}))

const pair = { accessToken: 'a', refreshToken: 'r', familyId: 'f', expiresInSeconds: 900 }

function renderPage(props: { readonly selfServe?: boolean } = {}) {
  window.history.replaceState({}, '', props.selfServe === true ? '/get-started' : '/onboarding/link-token')
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })

  return render(
    <QueryClientProvider client={client}>
      <OnboardingEntryPage {...props} />
    </QueryClientProvider>,
  )
}

async function signUpAndVerify(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Full name'), 'Ada Obi')
  await user.type(screen.getByLabelText('Work email'), 'ada@northwind.example')
  await user.type(screen.getByLabelText('Mobile number'), '+2348095532210')
  await user.click(screen.getByRole('button', { name: 'Send me a code' }))

  await user.type(await screen.findByLabelText(/Six-digit code/), '123456')
  await user.click(screen.getByRole('button', { name: /continue/i }))
}

describe('OnboardingEntryPage', () => {
  beforeEach(() => {
    navigate.mockReset()
    post.mockReset()
    claim.mockReset()
    claim.mockResolvedValue({})
    selfServe.mockReset()
    selfServe.mockResolvedValue({})
  })

  it('self-serve: names the company, signs in, chooses a password, and founds the company instead of claiming one', async () => {
    const user = userEvent.setup()
    post
      .mockResolvedValueOnce({ challengeId: 'c1', expiresAt: '2026-09-06T00:00:00Z' }) // signup
      .mockResolvedValueOnce({ ...pair, hasPassword: false }) // verify
      .mockResolvedValueOnce({}) // credentials

    renderPage({ selfServe: true })

    await user.type(await screen.findByLabelText('Company name'), 'Lekki Logistics')
    await signUpAndVerify(user)

    await screen.findByRole('heading', { name: 'Choose a password' })
    await user.type(screen.getByLabelText('New password'), 'correct-horse-battery')
    await user.type(screen.getByLabelText('Confirm password'), 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: 'Save password and continue' }))

    await waitFor(() => {
      expect(selfServe).toHaveBeenCalledWith({ companyName: 'Lekki Logistics', setupName: 'Ada Obi', setupPhone: '+2348095532210' })
    })
    expect(claim).not.toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith({ to: '/setup', replace: true })
  })

  it('self-serve: will not send a code until the company has a name', async () => {
    const user = userEvent.setup()
    renderPage({ selfServe: true })

    await user.type(await screen.findByLabelText('Full name'), 'Ada Obi')
    await user.type(screen.getByLabelText('Work email'), 'ada@northwind.example')
    await user.type(screen.getByLabelText('Mobile number'), '+2348095532210')
    expect(screen.getByRole('button', { name: 'Send me a code' })).toBeDisabled()

    await user.type(screen.getByLabelText('Company name'), 'Lekki Logistics')
    expect(screen.getByRole('button', { name: 'Send me a code' })).toBeEnabled()
  })

  it('asks for a password when the code sign-in says the account has none, then claims', async () => {
    const user = userEvent.setup()
    post
      .mockResolvedValueOnce({ challengeId: 'c1', expiresAt: '2026-09-06T00:00:00Z' }) // signup
      .mockResolvedValueOnce({ ...pair, hasPassword: false }) // verify
      .mockResolvedValueOnce({}) // credentials

    renderPage()
    await signUpAndVerify(user)

    // The console's sign-in page is password-only. Leaving here without one is a
    // locked door next time.
    expect(await screen.findByRole('heading', { name: 'Choose a password' })).toBeInTheDocument()
    expect(claim).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('New password'), 'correct-horse-battery')
    await user.type(screen.getByLabelText('Confirm password'), 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: 'Save password and continue' }))

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith('/v1/account/credentials', { json: { newPassword: 'correct-horse-battery' } })
    })
    await waitFor(() => { expect(claim).toHaveBeenCalledWith('link-token') })
    expect(navigate).toHaveBeenCalledWith({ to: '/setup', replace: true })
  })

  it('will not save a short password or a mismatched pair', async () => {
    const user = userEvent.setup()
    post
      .mockResolvedValueOnce({ challengeId: 'c1', expiresAt: '2026-09-06T00:00:00Z' })
      .mockResolvedValueOnce({ ...pair, hasPassword: false })

    renderPage()
    await signUpAndVerify(user)
    await screen.findByRole('heading', { name: 'Choose a password' })

    const save = screen.getByRole('button', { name: 'Save password and continue' })
    await user.type(screen.getByLabelText('New password'), 'short')
    await user.type(screen.getByLabelText('Confirm password'), 'short')
    expect(save).toBeDisabled()

    await user.clear(screen.getByLabelText('New password'))
    await user.type(screen.getByLabelText('New password'), 'correct-horse-battery')
    await user.clear(screen.getByLabelText('Confirm password'))
    await user.type(screen.getByLabelText('Confirm password'), 'correct-horse-batter')
    expect(screen.getByRole('alert')).toHaveTextContent('do not match')
    expect(save).toBeDisabled()
  })

  it('goes straight to the claim when the account already has a password', async () => {
    const user = userEvent.setup()
    post
      .mockResolvedValueOnce({ challengeId: 'c1', expiresAt: '2026-09-06T00:00:00Z' })
      .mockResolvedValueOnce({ ...pair, hasPassword: true })

    renderPage()
    await signUpAndVerify(user)

    await waitFor(() => { expect(claim).toHaveBeenCalledWith('link-token') })
    expect(screen.queryByRole('heading', { name: 'Choose a password' })).not.toBeInTheDocument()
    expect(post).not.toHaveBeenCalledWith('/v1/account/credentials', expect.anything())
  })
})
