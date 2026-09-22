/**
 * Lookup Client API Endpoint
 * GET /api/clients/lookup
 */

import { findClient } from '../_store'

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

    const client = findClient({ email, phone })

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
