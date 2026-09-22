/**
 * Create Client API Endpoint
 * POST /api/clients/create
 */

import crypto from 'crypto'
import { parseRequestBody } from '../../utils/http'
import { findClient, saveClient } from '../_store'
import { syncWithPlatform } from '../integrations/skintwin-sync'

export default async function createClient(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method not allowed' })
  }

  try {
    const data = parseRequestBody(req)
    const requiredFields = ['firstName', 'lastName', 'email', 'phone']

    for (const field of requiredFields) {
      if (!data[field]) {
        return res.status(400).json({
          status: false,
          message: `Missing required field: ${field}`,
        })
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(data.email)) {
      return res.status(400).json({
        status: false,
        message: 'Invalid email format',
      })
    }

    const phoneRegex = /^\+?[\d\s-]{10,}$/
    if (!phoneRegex.test(data.phone)) {
      return res.status(400).json({
        status: false,
        message: 'Invalid phone number format',
      })
    }

    const existing = findClient({ email: data.email })
    const clientId =
      existing?.id || data.id || `CLT_${Date.now()}_${crypto.randomUUID().split('-')[0]}`

    const client = {
      ...(existing || {}),
      id: clientId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email.toLowerCase(),
      phone: data.phone,
      consentAccepted: data.consentAccepted || false,
      intakeCompleted: data.intakeCompleted || false,
      preferences: data.preferences || existing?.preferences || {},
      notes: data.notes || existing?.notes || '',
      previousVisits: existing?.previousVisits || 0,
      preferredProvider: data.preferredProvider || existing?.preferredProvider || null,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    saveClient(client)
    const platform = await syncWithPlatform({ action: 'sync_client', payload: client })

    res.status(existing ? 200 : 201).json({
      status: true,
      message: existing ? 'Client updated successfully' : 'Client created successfully',
      data: {
        ...client,
        platform,
      },
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
