/**
 * SkinTwin AI Platform Integration Connector
 * POST /api/integrations/skintwin
 */

import { syncWithPlatform, transformPayload } from './skintwin-sync'
import { parseRequestBody } from '../../utils/http'

export default async function skintwinIntegration(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method not allowed' })
  }

  try {
    const data = parseRequestBody(req)
    const validActions = ['sync_appointment', 'sync_client', 'get_recommendations', 'log_treatment']

    if (!validActions.includes(data.action)) {
      return res.status(400).json({
        status: false,
        message: `Invalid action. Valid actions: ${validActions.join(', ')}`,
      })
    }

    const payload = data.appointment ||
      data.client ||
      data.treatment || {
        clientId: data.clientId,
        concerns: data.concerns,
        ...data.payload,
      }

    if (data.action === 'sync_appointment' && !payload?.id) {
      return res
        .status(400)
        .json({ status: false, message: 'Appointment data with ID is required' })
    }

    if (data.action === 'sync_client' && !payload?.id) {
      return res.status(400).json({ status: false, message: 'Client data with ID is required' })
    }

    if (data.action === 'log_treatment' && !payload?.appointmentId) {
      return res.status(400).json({
        status: false,
        message: 'Treatment data with appointment ID is required',
      })
    }

    if (data.action === 'get_recommendations' && !payload?.clientId) {
      return res.status(400).json({ status: false, message: 'Client ID is required' })
    }

    const result = await syncWithPlatform({ action: data.action, payload })

    if (data.action === 'get_recommendations') {
      return res.status(200).json({
        status: true,
        message: 'get_recommendations completed successfully',
        data: {
          ...result,
          recommendations: {
            clientId: payload.clientId,
            generatedAt: new Date().toISOString(),
            services: [
              {
                id: 'srv-001',
                name: 'Signature Facial',
                reason: 'Recommended for overall skin health',
                priority: 'high',
              },
            ],
            request: transformPayload(data.action, payload),
          },
        },
      })
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
