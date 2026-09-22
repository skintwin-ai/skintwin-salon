import { afterEach, describe, expect, it } from 'vitest'
import {
  authorizationForSync,
  issuePlatformSession,
  verifyPlatformSession,
} from './platform-session.js'

describe('platform session', () => {
  afterEach(() => {
    delete process.env.SKINTWIN_PLATFORM_KEY
  })

  it('signs a salon sync authorization around the client email', () => {
    process.env.SKINTWIN_PLATFORM_KEY = 'mesh-secret'
    const header = authorizationForSync({
      client: { email: 'Adaeze.Obi@Example.com' },
    })
    expect(header?.startsWith('Bearer stsess.')).toBe(true)
    expect(verifyPlatformSession(header)?.email).toBe('adaeze.obi@example.com')
  })

  it('round-trips a session token', () => {
    process.env.SKINTWIN_PLATFORM_KEY = 'mesh-secret'
    const token = issuePlatformSession({
      email: 'salon@skintwin.ai',
      name: 'SkinTwin Salon',
      role: 'platform',
      source: 'skintwin-salon',
    })
    expect(verifyPlatformSession(token)?.source).toBe('skintwin-salon')
  })
})
