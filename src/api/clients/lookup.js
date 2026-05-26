/**
 * Lookup Client API Endpoint
 * GET /api/clients/lookup
 * 
 * Query params:
 * - email: client email address
 * - phone: client phone number (alternative)
 */

export default async function lookupClient(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ status: false, message: 'Method not allowed' })
  }

  try {
    const { email, phone } = req.query

    if (!email && !phone) {
      return res.status(400).json({
        status: false,
        message: 'Email or phone number is required',
      })
    }

    // In real implementation, would query database
    // For now, simulate lookup with sample data

    const sampleClients = [
      {
        id: 'clt-001',
        firstName: 'Adaeze',
        lastName: 'Obi',
        email: 'adaeze.obi@example.com',
        phone: '+2348012345678',
        consentAccepted: true,
        intakeCompleted: true,
        previousVisits: 5,
        preferredProvider: 'prv-001',
        lastVisit: '2024-01-15',
      },
      {
        id: 'clt-002',
        firstName: 'Folake',
        lastName: 'Adeyemi',
        email: 'folake.adeyemi@example.com',
        phone: '+2348023456789',
        consentAccepted: true,
        intakeCompleted: true,
        previousVisits: 2,
        preferredProvider: null,
        lastVisit: '2024-02-01',
      },
    ]

    // Search by email or phone
    const searchEmail = email?.toLowerCase()
    const searchPhone = phone?.replace(/\D/g, '')

    const client = sampleClients.find((c) => {
      if (searchEmail && c.email.toLowerCase() === searchEmail) return true
      if (searchPhone && c.phone.replace(/\D/g, '').includes(searchPhone)) return true
      return false
    })

    if (!client) {
      return res.status(404).json({
        status: false,
        message: 'Client not found',
      })
    }

    res.status(200).json({
      status: true,
      message: 'Client found',
      data: {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        consentAccepted: client.consentAccepted,
        intakeCompleted: client.intakeCompleted,
        previousVisits: client.previousVisits,
        preferredProvider: client.preferredProvider,
        lastVisit: client.lastVisit,
      },
    })
  } catch (error) {
    console.error('Error looking up client:', error)
    res.status(500).json({
      status: false,
      message: 'Error looking up client',
      error: error.message,
    })
  }
}
