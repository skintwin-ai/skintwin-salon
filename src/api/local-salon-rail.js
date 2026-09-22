import { isLocalPaystackRail, localPaystackInvoice, localPaystackTerminal } from './integrations/paystack-rail.js'
import { syncWithPlatform } from './integrations/skintwin-sync.js'

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
    const result = await syncWithPlatform({ action, payload })
    return {
      status: 200,
      body: { status: true, message: `${action} completed successfully`, data: result },
    }
  }

  return { status: 404, body: { status: false, message: `No salon route for ${method} ${pathname}` } }
}
