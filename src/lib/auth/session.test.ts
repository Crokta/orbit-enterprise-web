import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearSession, deviceFingerprint, getAccessToken, isSessionValid, refreshAccessToken, setSession } from './session'

describe('session', () => {
  beforeEach(() => {
    clearSession()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('holds the token in memory and never in storage', () => {
    setSession('tok_abc', 900)

    expect(getAccessToken()).toBe('tok_abc')

    // A token in localStorage is readable by any script that ends up on the page,
    // which includes anything a compromised dependency puts there.
    expect(localStorage.getItem('orbit-token')).toBeNull()
    expect(Object.values(localStorage)).not.toContain('tok_abc')
  })

  it('expires a token early, before the server would', () => {
    vi.useFakeTimers()
    setSession('tok_abc', 60)

    // 30 seconds of margin, so a token does not expire in flight between the check
    // here and the server reading it. Clocks drift and networks are slow.
    vi.advanceTimersByTime(29_000)
    expect(isSessionValid()).toBe(true)

    vi.advanceTimersByTime(2_000)
    expect(isSessionValid()).toBe(false)
  })

  it('collapses concurrent refreshes into one request', async () => {
    setSession('tok_old', 900, { refreshToken: 'rt_1', familyId: 'fam_1' })

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ accessToken: 'tok_new', refreshToken: 'rt_2', familyId: 'fam_1', expiresInSeconds: 900 }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const results = await Promise.all([refreshAccessToken(), refreshAccessToken(), refreshAccessToken()])

    expect(results).toEqual([true, true, true])

    // Three refreshes would rotate the token family three times, which the identity
    // service correctly reads as reuse and answers by revoking the whole family.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getAccessToken()).toBe('tok_new')

    // The rotated refresh token replaces the spent one, bound to this browser.
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, string>
    expect(body['refreshToken']).toBe('rt_1')
    expect(body['familyId']).toBe('fam_1')
    expect(body['deviceFingerprint']).toBe(deviceFingerprint())
    expect(sessionStorage.getItem('orbit-refresh')).toContain('rt_2')
  })

  it('does not call the network when there is nothing to trade in', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect(await refreshAccessToken()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps the same device fingerprint across calls', () => {
    expect(deviceFingerprint()).toBe(deviceFingerprint())
    expect(deviceFingerprint()).toMatch(/^web-/)
  })

  it('clears the session when the refresh is rejected', async () => {
    setSession('tok_old', 900, { refreshToken: 'rt_1', familyId: 'fam_1' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })))

    expect(await refreshAccessToken()).toBe(false)
    expect(getAccessToken()).toBeNull()
  })

  it('clears the session when the network fails', async () => {
    setSession('tok_old', 900, { refreshToken: 'rt_1', familyId: 'fam_1' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))

    expect(await refreshAccessToken()).toBe(false)

    // Continuing with a token known to be expired produces a stream of 401s that look
    // like an auth bug rather than a dropped connection.
    expect(getAccessToken()).toBeNull()
  })

  it('notifies subscribers on sign-in and sign-out', () => {
    const seen: boolean[] = []
    const unsubscribe = (() => {
      const listener = (signedIn: boolean) => seen.push(signedIn)
      return import('./session').then((m) => m.onSessionChange(listener))
    })()

    return unsubscribe.then((off) => {
      setSession('tok_abc', 900)
      clearSession()
      off()

      expect(seen).toEqual([true, false])
    })
  })
})
