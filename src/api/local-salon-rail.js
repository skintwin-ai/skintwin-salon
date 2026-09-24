import { isLocalPaystackRail, localPaystackInvoice, localPaystackTerminal } from './integrations/paystack-rail.js'

async function persistSalonSync(action, payload) {
  const apiUrl = (process.env.SKINTWIN_API_URL || '').replace(/\/$/, '')
  const key = process.env.SKINTWIN_PLATFORM_KEY
  if (apiUrl && key) {
    try {
      const response = await fetch(`${apiUrl}/api/platform/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ action, source: 'skintwin-salon', data: payload }),
      })
      const remote = await response.json().catch(() => ({}))
      return {
        synced: response.ok,
        mode: response.ok ? 'remote' : 'local',
        persisted: true,
        skintwinId: remote.id || remote.skintwinId || null,
        error: response.ok ? undefined : remote.message || `Platform sync failed with ${response.status}`,
      }
    } catch (error) {
      return { synced: false, mode: 'local', persisted: true, error: error.message }
    }
  }
  return { synced: false, mode: 'local', persisted: true }
}

export async function handleSalonApi(method, pathname, body = {}) {
  if (pathname === '/api/create_invoice' && method === 'POST') {
    if (!isLocalPaystackRail()) {
      return { status: 409, body: { status: false, message: 'Live Paystack keys are set' } }
    }
    return { status: 200, body: localPaystackInvoice(body) }
  }

  if (pathname === '/api/push_to_terminal' && method === 'POST') {
    if (!isLocalPaystackRail()) {
      return { status: 409, body: { status: false, message: 'Live Paystack keys are set' } }
    }
    return { status: 200, body: localPaystackTerminal(body) }
  }

  if (pathname === '/api/integrations/skintwin' && method === 'POST') {
    const action = body.action
    const payload =
      body.appointment ||
      body.client ||
      body.treatment || {
        clientId: body.clientId,
        concerns: body.concerns,
        ...body.payload,
      }
    if (!action) {
      return { status: 400, body: { status: false, message: 'action is required' } }
    }
    const result = await persistSalonSync(action, payload)
    return {
      status: 200,
      body: { status: true, message: `${action} completed successfully`, data: result },
    }
  }

  return { status: 404, body: { status: false, message: `No salon route for ${method} ${pathname}` } }
}
