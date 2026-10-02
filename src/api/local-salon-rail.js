import { isLocalPaystackRail, localPaystackInvoice, localPaystackTerminal } from './integrations/paystack-rail.js'
import { recordAppointmentCancellation, recordInvoiceSettlement, recordSyncedDelivery, salonSupplyChainResponse } from '../../chain_stage.mjs'
import { invoiceAppointmentId, invoiceServicesForLedger } from '../utils/invoice-payload.mjs'
import { getAppointment, saveAppointment } from './_store.js'

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

function appointmentRecord(body, existing = {}) {
  return {
    ...existing,
    id: body.id || existing.id,
    services: body.services || existing.services,
    date: body.date || existing.date,
    startTime: body.startTime || existing.startTime,
    endTime: body.endTime || existing.endTime || null,
    providerId: body.providerId || existing.providerId,
    roomId: body.roomId || existing.roomId || null,
    client: body.client || existing.client,
    status: body.status || existing.status || 'draft',
    totalAmount: body.totalAmount ?? existing.totalAmount ?? 0,
    currency: body.currency || existing.currency || 'NGN',
    notes: body.notes || existing.notes,
    updatedAt: new Date().toISOString(),
    createdAt: existing.createdAt || new Date().toISOString(),
  }
}

export async function handleSalonApi(method, pathname, body = {}) {
  const supplyChain = salonSupplyChainResponse(method, pathname, body)
  if (supplyChain) return supplyChain

  if (pathname === '/api/create_invoice' && method === 'POST') {
    const services = invoiceServicesForLedger(body)
    if (services.length > 0) {
      const delivered = recordSyncedDelivery(invoiceAppointmentId(body), services)
      if (!delivered.ok) {
        return { status: 400, body: { status: false, message: delivered.error } }
      }
    }
    if (!isLocalPaystackRail()) {
      return { status: 409, body: { status: false, message: 'Live Paystack keys are set' } }
    }
    return { status: 200, body: localPaystackInvoice(body) }
  }

  if (pathname === '/api/push_to_terminal' && method === 'POST') {
    if (!isLocalPaystackRail()) {
      return { status: 409, body: { status: false, message: 'Live Paystack keys are set' } }
    }
    const settled = recordInvoiceSettlement(body)
    if (!settled.ok) {
      return { status: 400, body: { status: false, message: settled.error } }
    }
    return { status: 200, body: localPaystackTerminal(body) }
  }

  if (pathname === '/api/appointments/create' && method === 'POST') {
    for (const field of ['services', 'date', 'startTime', 'providerId', 'client']) {
      if (!body[field]) {
        return { status: 400, body: { status: false, message: `Missing required field: ${field}` } }
      }
    }
    if (!Array.isArray(body.services) || body.services.length === 0) {
      return { status: 400, body: { status: false, message: 'At least one service is required' } }
    }
    if (!body.client.consentAccepted) {
      return { status: 400, body: { status: false, message: 'Client consent is required' } }
    }
    const appointmentId = body.id || `APT_${Date.now()}`
    const delivered = recordSyncedDelivery(appointmentId, body.services)
    if (!delivered.ok) {
      return { status: 400, body: { status: false, message: delivered.error } }
    }
    const appointment = appointmentRecord({ ...body, id: appointmentId })
    saveAppointment(appointment)
    return {
      status: 201,
      body: { status: true, message: 'Appointment created successfully', data: appointment },
    }
  }

  if (pathname === '/api/appointments/update' && (method === 'PUT' || method === 'POST')) {
    if (!body.id) {
      return { status: 400, body: { status: false, message: 'Appointment ID is required' } }
    }
    const existing = getAppointment(body.id) || { id: body.id }
    if (body.status === 'cancelled') {
      const returned = recordAppointmentCancellation(body.id)
      if (!returned.ok) {
        return { status: 400, body: { status: false, message: returned.error } }
      }
    } else if (body.services) {
      const delivered = recordSyncedDelivery(body.id, body.services)
      if (!delivered.ok) {
        return { status: 400, body: { status: false, message: delivered.error } }
      }
    }
    const appointment = appointmentRecord(body, existing)
    saveAppointment(appointment)
    return {
      status: 200,
      body: { status: true, message: 'Appointment updated successfully', data: appointment },
    }
  }

  if (pathname === '/api/appointments/cancel' && method === 'POST') {
    if (!body.id) {
      return { status: 400, body: { status: false, message: 'Appointment ID is required' } }
    }
    const appointmentStatus = body.currentStatus || 'scheduled'
    if (['completed', 'cancelled', 'no_show'].includes(appointmentStatus)) {
      return {
        status: 400,
        body: { status: false, message: `Cannot cancel appointment with status: ${appointmentStatus}` },
      }
    }
    const returned = recordAppointmentCancellation(body.id)
    if (!returned.ok) {
      return { status: 400, body: { status: false, message: returned.error } }
    }
    return {
      status: 200,
      body: {
        status: true,
        message: 'Appointment cancelled successfully',
        data: { id: body.id, status: 'cancelled' },
      },
    }
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
    if (action === 'sync_appointment' || action === 'log_treatment') {
      const delivered = recordSyncedDelivery(
        action === 'log_treatment' ? payload?.appointmentId : payload?.id,
        payload?.services,
      )
      if (!delivered.ok) {
        return { status: 400, body: { status: false, message: delivered.error } }
      }
    }
    const result = await persistSalonSync(action, payload)
    return {
      status: 200,
      body: { status: true, message: `${action} completed successfully`, data: result },
    }
  }

  return { status: 404, body: { status: false, message: `No salon route for ${method} ${pathname}` } }
}
