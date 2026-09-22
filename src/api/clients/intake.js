/**
 * Submit Intake Form API Endpoint
 * POST /api/clients/intake
 */

import { parseRequestBody } from '../../utils/http'
import { getClient, saveClient } from '../_store'
import { syncWithPlatform } from '../integrations/skintwin-sync'

export default async function submitIntake(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method not allowed' })
  }

  try {
    const data = parseRequestBody(req)

    if (!data.clientId) {
      return res.status(400).json({
        status: false,
        message: 'Client ID is required',
      })
    }

    if (!data.consentAccepted) {
      return res.status(400).json({
        status: false,
        message: 'Consent is required to proceed',
      })
    }

    const existing = getClient(data.clientId)
    if (!existing) {
      return res.status(404).json({
        status: false,
        message: 'Client not found',
      })
    }

    const intake = {
      id: `INT_${Date.now()}`,
      clientId: data.clientId,
      submittedAt: new Date().toISOString(),
      skinType: data.skinType || 'unknown',
      skinConcerns: data.skinConcerns || [],
      allergies: data.allergies || [],
      medications: data.medications || '',
      currentProducts: data.currentProducts || [],
      previousTreatments: data.previousTreatments || '',
      medicalHistory: data.medicalHistory || '',
      pregnancyStatus: data.pregnancyStatus || 'not_applicable',
      treatmentGoals: data.treatmentGoals || '',
      consentAccepted: data.consentAccepted,
      consentTimestamp: new Date().toISOString(),
      photoReleaseConsent: data.photoReleaseConsent || false,
      marketingConsent: data.marketingConsent || false,
    }

    const client = saveClient({
      ...existing,
      ...data,
      id: data.clientId,
      firstName: data.firstName || existing.firstName,
      lastName: data.lastName || existing.lastName,
      email: data.email || existing.email,
      phone: data.phone || existing.phone,
      intakeCompleted: true,
      intakeId: intake.id,
      consentAccepted: true,
      skinType: intake.skinType,
      allergies: intake.allergies,
      updatedAt: new Date().toISOString(),
    })

    const platform = await syncWithPlatform({ action: 'sync_client', payload: client })

    res.status(200).json({
      status: true,
      message: 'Intake form submitted successfully',
      data: {
        intake,
        client,
        platform,
      },
    })
  } catch (error) {
    console.error('Error submitting intake:', error)
    res.status(500).json({
      status: false,
      message: 'Error submitting intake form',
      error: error.message,
    })
  }
}
