/**
 * Submit Intake Form API Endpoint
 * POST /api/clients/intake
 */

export default async function submitIntake(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method not allowed' })
  }

  try {
    const data = JSON.parse(req.body)

    // Validate client ID
    if (!data.clientId) {
      return res.status(400).json({
        status: false,
        message: 'Client ID is required',
      })
    }

    // Validate required intake fields
    const requiredFields = ['skinType', 'allergies', 'currentProducts']
    const missingFields = requiredFields.filter((field) => data[field] === undefined)

    // Allow empty arrays/strings but require field presence
    if (missingFields.length > 0) {
      return res.status(400).json({
        status: false,
        message: `Missing required intake fields: ${missingFields.join(', ')}`,
      })
    }

    // Validate consent
    if (!data.consentAccepted) {
      return res.status(400).json({
        status: false,
        message: 'Consent is required to proceed',
      })
    }

    // Create intake record
    const intake = {
      id: `INT_${Date.now()}`,
      clientId: data.clientId,
      submittedAt: new Date().toISOString(),
      skinType: data.skinType,
      skinConcerns: data.skinConcerns || [],
      allergies: data.allergies,
      medications: data.medications || '',
      currentProducts: data.currentProducts,
      previousTreatments: data.previousTreatments || '',
      medicalHistory: data.medicalHistory || '',
      pregnancyStatus: data.pregnancyStatus || 'not_applicable',
      treatmentGoals: data.treatmentGoals || '',
      consentAccepted: data.consentAccepted,
      consentTimestamp: new Date().toISOString(),
      photoReleaseConsent: data.photoReleaseConsent || false,
      marketingConsent: data.marketingConsent || false,
    }

    // Update client record (in real implementation)
    const clientUpdate = {
      clientId: data.clientId,
      intakeCompleted: true,
      intakeId: intake.id,
      updatedAt: new Date().toISOString(),
    }

    res.status(200).json({
      status: true,
      message: 'Intake form submitted successfully',
      data: {
        intake,
        clientUpdate,
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
