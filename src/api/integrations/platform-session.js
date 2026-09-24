import { createHmac, timingSafeEqual } from 'node:crypto'

const PREFIX = 'stsess.'

function canonicalEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function platformSecret() {
  return process.env.SKINTWIN_PLATFORM_KEY || ''
}

function signBody(body, secret) {
  return createHmac('sha256', secret).update(body).digest('base64url')
}

function safeEqual(left, right) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function issuePlatformSession(actor, ttlMs = 12 * 60 * 60 * 1000) {
  const secret = platformSecret()
  if (!secret) {
    throw new Error('SKINTWIN_PLATFORM_KEY is not configured')
  }
  const payload = {
    v: 1,
    email: canonicalEmail(actor.email),
    name: actor.name,
    role: actor.role,
    source: actor.source,
    exp: Date.now() + ttlMs,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${PREFIX}${body}.${signBody(body, secret)}`
}

export function verifyPlatformSession(token) {
  const secret = platformSecret()
  if (!secret || !token) {
    return null
  }
  const raw = token.startsWith('Bearer ') ? token.slice(7) : token
  if (safeEqual(raw, secret)) {
    return {
      email: 'platform@skintwin.ai',
      name: 'SkinTwin Platform',
      role: 'platform',
      source: 'platform-key',
    }
  }
  if (!raw.startsWith(PREFIX)) {
    return null
  }
  const rest = raw.slice(PREFIX.length)
  const dot = rest.lastIndexOf('.')
  if (dot < 1) {
    return null
  }
  const body = rest.slice(0, dot)
  const sig = rest.slice(dot + 1)
  if (!safeEqual(sig, signBody(body, secret))) {
    return null
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (payload.v !== 1 || !payload.email || payload.exp < Date.now()) {
      return null
    }
    return {
      email: canonicalEmail(payload.email),
      name: payload.name,
      role: payload.role,
      source: payload.source,
    }
  } catch {
    return null
  }
}

export function authorizationForSync(payload) {
  const secret = platformSecret()
  if (!secret) {
    return null
  }
  const email =
    payload?.client?.email ||
    payload?.profile?.email ||
    payload?.email ||
    'salon@skintwin.ai'
  try {
    return `Bearer ${issuePlatformSession({
      email,
      name: 'SkinTwin Salon',
      role: 'platform',
      source: 'skintwin-salon',
    })}`
  } catch {
    return `Bearer ${secret}`
  }
}
