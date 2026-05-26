/**
 * Create Client API Endpoint
 * POST /api/clients/create
 */

import crypto from 'crypto'

export default async function createClient(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method not allowed' })
  }

  try {
    const data = JSON.parse(req.body)

    // Validate required fields
    const requiredFields = ['firstName', 'lastName', 'email', 'phone']
    for (const field of requiredFields) {
      if (!data[field]) {
        return res.status(400).json({
          status: false,
          message: `Missing required field: ${field}`,
        })
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(data.email)) {
      return res.status(400).json({
        status: false,
        message: 'Invalid email format',
      })
    }

    // Validate phone format (basic validation)
    const phoneRegex = /^\+?[\d\s-]{10,}$/
    if (!phoneRegex.test(data.phone)) {
      return res.status(400).json({
        status: false,
        message: 'Invalid phone number format',
      })
    }

    // Generate client ID using crypto for secure unique IDs
    const clientId = `CLT_${Date.now()}_${crypto.randomUUID().split('-')[0]}`

    // Create client object
    const client = {
      id: clientId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email.toLowerCase(),
      phone: data.phone,
      consentAccepted: data.consentAccepted || false,
      intakeCompleted: data.intakeCompleted || false,
      preferences: data.preferences || {},
      notes: data.notes || '',
      previousVisits: 0,
      preferredProvider: data.preferredProvider || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    res.status(201).json({
      status: true,
      message: 'Client created successfully',
      data: client,
    })
  } catch (error) {
    console.error('Error creating client:', error)
    res.status(500).json({
      status: false,
      message: 'Error creating client',
      error: error.message,
    })
  }
}
