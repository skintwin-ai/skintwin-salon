/**
 * SkinTwin platform sync helper.
 * Writes the transformed payload locally always.
 * Only claims a remote platform id when SKINTWIN_API_URL + SKINTWIN_PLATFORM_KEY are set
 * and the remote call succeeds.
 */

import { persistSync } from '../_store'
import { authorizationForSync } from './platform-session.js'

function mapStatus(internalStatus) {
  const statusMap = {
    draft: 'pending',
    scheduled: 'confirmed',
    payment_pending: 'awaiting_payment',
    paid: 'confirmed_paid',
    checked_in: 'in_progress',
    in_progress: 'in_progress',
    completed: 'completed',
    cancelled: 'cancelled',
    no_show: 'no_show',
  }

  return statusMap[internalStatus] || 'unknown'
}

export function transformAppointment(appointment = {}) {
  return {
    externalId: appointment.id,
    source: 'skintwin-salon',
    scheduledAt: appointment.startTime,
    date: appointment.date,
    duration: appointment.durationMinutes || appointment.totalDurationMinutes,
    services: (appointment.services || []).map((service) => ({
      externalId: service.serviceId || service.id,
      name: service.name,
      category: service.category,
    })),
    provider: appointment.provider
      ? {
          externalId: appointment.provider.id,
          name: appointment.provider.name,
        }
      : appointment.providerId
        ? { externalId: appointment.providerId }
        : null,
    client: appointment.client
      ? {
          externalId: appointment.client.id,
          email: appointment.client.email,
        }
      : null,
    status: mapStatus(appointment.status),
    metadata: {
      roomId: appointment.roomId,
      notes: appointment.notes,
      createdAt: appointment.createdAt,
    },
  }
}

export function transformClient(client = {}) {
  return {
    externalId: client.id,
    source: 'skintwin-salon',
    profile: {
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
    },
    skin: {
      type: client.skinType,
      concerns: client.skinConcerns || [],
      allergies: client.allergies || [],
    },
    preferences: client.preferences || {},
    consentStatus: {
      dataProcessing: client.consentAccepted,
      marketing: client.marketingConsent || false,
      photoRelease: client.photoReleaseConsent || false,
    },
  }
}

export function transformPayload(action, data) {
  switch (action) {
    case 'sync_appointment':
      return transformAppointment(data)
    case 'sync_client':
      return transformClient(data)
    case 'log_treatment':
      return {
        appointmentId: data?.appointmentId,
        clientId: data?.clientId,
        providerId: data?.providerId,
        completedAt: new Date().toISOString(),
        services: data?.services || [],
        notes: data?.notes,
      }
    case 'get_recommendations':
      return {
        clientId: data?.clientId,
        concerns: data?.concerns || [],
      }
    default:
      return data || {}
  }
}

function platformConfig() {
  const apiUrl = (process.env.SKINTWIN_API_URL || '').replace(/\/$/, '')
  const key = process.env.SKINTWIN_PLATFORM_KEY
  return { apiUrl, key, configured: Boolean(apiUrl && key) }
}

export async function syncWithPlatform({ action, payload }) {
  const transformed = transformPayload(action, payload)
  const timestamp = new Date().toISOString()
  const record = {
    id: `local_sync_${Date.now()}`,
    action,
    payload: transformed,
    createdAt: timestamp,
    remote: false,
    skintwinId: null,
  }

  persistSync(record)

  const { apiUrl, key, configured } = platformConfig()

  if (!configured) {
    return {
      synced: false,
      mode: 'local',
      persisted: true,
      externalId: transformed.externalId || payload?.id || null,
      skintwinId: null,
      timestamp,
    }
  }

  try {
    const response = await fetch(`${apiUrl}/api/platform/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorizationForSync(payload) || `Bearer ${key}`,
      },
      body: JSON.stringify({
        action,
        source: 'skintwin-salon',
        data: transformed,
      }),
    })

    const remote = await response.json().catch(() => ({}))
    const remoteId = remote.id || remote.skintwinId || remote.data?.id || null

    if (response.ok) {
      record.remote = true
      record.skintwinId = remoteId
      return {
        synced: true,
        mode: 'remote',
        persisted: true,
        externalId: transformed.externalId || payload?.id || null,
        skintwinId: remoteId,
        timestamp: new Date().toISOString(),
      }
    }

    return {
      synced: false,
      mode: 'local',
      persisted: true,
      externalId: transformed.externalId || payload?.id || null,
      skintwinId: null,
      error: remote.message || `Platform sync failed with ${response.status}`,
      timestamp,
    }
  } catch (error) {
    return {
      synced: false,
      mode: 'local',
      persisted: true,
      externalId: transformed.externalId || payload?.id || null,
      skintwinId: null,
      error: error.message,
      timestamp,
    }
  }
}

export { mapStatus }
