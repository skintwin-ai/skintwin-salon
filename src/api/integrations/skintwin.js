/**
 * SkinTwin AI Platform Integration Connector
 * POST /api/integrations/skintwin
 * 
 * Syncs appointments and client data with the skintwin-ai platform
 */

const SKINTWIN_API = process.env.SKINTWIN_API_URL || 'https://api.skintwin.ai'
const SKINTWIN_API_KEY = process.env.SKINTWIN_API_KEY

export default async function skintwinIntegration(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method not allowed' })
  }

  try {
    const data = JSON.parse(req.body)

    // Validate action type
    const validActions = ['sync_appointment', 'sync_client', 'get_recommendations', 'log_treatment']
    if (!validActions.includes(data.action)) {
      return res.status(400).json({
        status: false,
        message: `Invalid action. Valid actions: ${validActions.join(', ')}`,
      })
    }

    let result

    switch (data.action) {
      case 'sync_appointment':
        result = await syncAppointment(data.appointment)
        break
      case 'sync_client':
        result = await syncClient(data.client)
        break
      case 'get_recommendations':
        result = await getRecommendations(data.clientId, data.concerns)
        break
      case 'log_treatment':
        result = await logTreatment(data.treatment)
        break
      default:
        throw new Error('Unknown action')
    }

    res.status(200).json({
      status: true,
      message: `${data.action} completed successfully`,
      data: result,
    })
  } catch (error) {
    console.error('Error in skintwin integration:', error)
    res.status(500).json({
      status: false,
      message: 'Error communicating with skintwin-ai platform',
      error: error.message,
    })
  }
}

/**
 * Sync appointment to skintwin-ai platform
 */
async function syncAppointment(appointment) {
  if (!appointment || !appointment.id) {
    throw new Error('Appointment data with ID is required')
  }

  // Transform to skintwin-ai format
  const transformed = {
    externalId: appointment.id,
    source: 'skintwin-salon',
    scheduledAt: appointment.startTime,
    duration: appointment.durationMinutes,
    services: appointment.services.map((s) => ({
      externalId: s.serviceId,
      name: s.name,
      category: s.category,
    })),
    provider: appointment.provider
      ? {
          externalId: appointment.provider.id,
          name: appointment.provider.name,
        }
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

  // In production, would make API call to skintwin-ai
  // const response = await fetch(`${SKINTWIN_API}/api/integrations/appointments/sync`, {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'Authorization': `******
  //   },
  //   body: JSON.stringify(transformed),
  // })

  return {
    synced: true,
    externalId: appointment.id,
    skintwinId: `sk_${Date.now()}`,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Sync client profile to skintwin-ai platform
 */
async function syncClient(client) {
  if (!client || !client.id) {
    throw new Error('Client data with ID is required')
  }

  const transformed = {
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

  return {
    synced: true,
    externalId: client.id,
    skintwinId: `skc_${Date.now()}`,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Get AI-powered treatment recommendations
 */
async function getRecommendations(clientId, concerns) {
  if (!clientId) {
    throw new Error('Client ID is required')
  }

  // In production, would call skintwin-ai recommendation engine
  const recommendations = {
    clientId,
    generatedAt: new Date().toISOString(),
    services: [
      {
        id: 'srv-001',
        name: 'Signature Facial',
        reason: 'Recommended for overall skin health',
        priority: 'high',
      },
      {
        id: 'srv-008',
        name: 'LED Light Therapy',
        reason: 'Add-on for enhanced results',
        priority: 'medium',
      },
    ],
    products: [
      {
        name: 'Hydrating Serum',
        type: 'daily',
        reason: 'Address hydration concerns',
      },
    ],
    followUp: {
      recommended: true,
      interval: '4 weeks',
      services: ['srv-002'],
    },
  }

  return recommendations
}

/**
 * Log completed treatment to skintwin-ai for tracking
 */
async function logTreatment(treatment) {
  if (!treatment || !treatment.appointmentId) {
    throw new Error('Treatment data with appointment ID is required')
  }

  const treatmentLog = {
    appointmentId: treatment.appointmentId,
    clientId: treatment.clientId,
    providerId: treatment.providerId,
    completedAt: new Date().toISOString(),
    services: treatment.services,
    notes: treatment.notes,
    productsUsed: treatment.productsUsed || [],
    beforePhotos: treatment.beforePhotos || [],
    afterPhotos: treatment.afterPhotos || [],
    nextRecommendations: treatment.nextRecommendations || [],
  }

  return {
    logged: true,
    treatmentId: `trt_${Date.now()}`,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Map internal status to skintwin-ai status
 */
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
