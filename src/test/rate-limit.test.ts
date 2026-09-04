import {
  checkRateLimit,
  resetRateLimit,
  getClientIp,
} from '@/lib/rate-limit'

describe('Rate Limiter', () => {
  let now: number
  let dateNowSpy: jest.SpyInstance

  beforeAll(() => {
    now = 1_000_000
    dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now)
  })

  afterAll(() => {
    dateNowSpy.mockRestore()
  })

  beforeEach(() => {
    resetRateLimit()
  })

  const advance = (ms: number) => {
    now += ms
  }

  describe('checkRateLimit', () => {
    it('should allow requests up to the max', () => {
      const config = { windowMs: 60_000, max: 3 }

      expect(checkRateLimit('a', config).allowed).toBe(true)
      expect(checkRateLimit('a', config).allowed).toBe(true)
      expect(checkRateLimit('a', config).allowed).toBe(true)
    })

    it('should block the request over the max', () => {
      const config = { windowMs: 60_000, max: 2 }

      checkRateLimit('a', config)
      checkRateLimit('a', config)
      const result = checkRateLimit('a', config)

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should track keys independently', () => {
      const config = { windowMs: 60_000, max: 1 }

      expect(checkRateLimit('a', config).allowed).toBe(true)
      expect(checkRateLimit('b', config).allowed).toBe(true)
      expect(checkRateLimit('a', config).allowed).toBe(false)
      expect(checkRateLimit('b', config).allowed).toBe(false)
    })

    it('should reset after the window elapses', () => {
      const config = { windowMs: 60_000, max: 1 }

      expect(checkRateLimit('a', config).allowed).toBe(true)
      expect(checkRateLimit('a', config).allowed).toBe(false)

      advance(60_000)

      expect(checkRateLimit('a', config).allowed).toBe(true)
    })

    it('should report remaining, reset time and retryAfter', () => {
      const config = { windowMs: 60_000, max: 5 }

      const result = checkRateLimit('a', config)

      expect(result.remaining).toBe(4)
      expect(result.resetAt).toBe(now + 60_000)
      expect(result.retryAfter).toBe(60)
    })

    it('should report seconds until reset when blocked', () => {
      const config = { windowMs: 60_000, max: 1 }

      checkRateLimit('a', config)
      advance(10_000) // 50 seconds left in the window

      const result = checkRateLimit('a', config)

      expect(result.allowed).toBe(false)
      expect(result.retryAfter).toBe(50)
    })

    it('should clear state via resetRateLimit', () => {
      const config = { windowMs: 60_000, max: 1 }

      checkRateLimit('a', config)
      expect(checkRateLimit('a', config).allowed).toBe(false)

      resetRateLimit('a')

      expect(checkRateLimit('a', config).allowed).toBe(true)
    })

    it('should clear all state when resetRateLimit has no key', () => {
      const config = { windowMs: 60_000, max: 1 }

      checkRateLimit('a', config)
      checkRateLimit('b', config)

      resetRateLimit()

      expect(checkRateLimit('a', config).allowed).toBe(true)
      expect(checkRateLimit('b', config).allowed).toBe(true)
    })
  })

  describe('getClientIp', () => {
    const makeRequest = (headers: Record<string, string>, ip?: string) => ({
      headers: {
        get: (name: string) => headers[name.toLowerCase()] ?? null,
      },
      ip,
    })

    it('should use the first x-forwarded-for entry', () => {
      const ip = getClientIp(makeRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))

      expect(ip).toBe('1.2.3.4')
    })

    it('should fall back to x-real-ip', () => {
      expect(getClientIp(makeRequest({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9')
    })

    it('should fall back to request.ip', () => {
      expect(getClientIp(makeRequest({}, '8.8.8.8'))).toBe('8.8.8.8')
    })

    it('should fall back to unknown', () => {
      expect(getClientIp(makeRequest({}))).toBe('unknown')
    })
  })
})
