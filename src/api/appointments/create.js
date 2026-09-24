/**
 * Create Appointment API Endpoint
 * POST /api/appointments/create
 */

import crypto from 'crypto'
import { parseRequestBody } from '../../utils/http'
import { saveAppointment } from '../_store'
import { syncWithPlatform } from '../integrations/skintwin-sync'

export default async function createAppointment(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method not allowed' })
  }

  try {
    const data = parseRequestBody(req)
    const requiredFields = ['services', 'date', 'startTime', 'providerId', 'client']

    for (const field of requiredFields) {
      if (!data[field]) {
        return res.status(400).json({
          status: false,
          message: `Missing required field: ${field}`,
        })
      }
    }

    if (!Array.isArray(data.services) || data.services.length === 0) {
      return res.status(400).json({
        status: false,
        message: 'At least one service is required',
      })
    }

    if (!data.client.consentAccepted) {
      return res.status(400).json({
        status: false,
        message: 'Client consent is required',
      })
    }

    const appointmentId = data.id || `APT_${Date.now()}_${crypto.randomUUID().split('-')[0]}`
    const reference = `REF_${Date.now()}`

    const appointment = {
      id: appointmentId,
      reference,
      services: data.services,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime || null,
      providerId: data.providerId,
      roomId: data.roomId || null,
      client: {
        id: data.client.id || `CLT_${Date.now()}`,
        firstName: data.client.firstName,
        lastName: data.client.lastName,
        email: data.client.email,
        phone: data.client.phone,
        consentAccepted: data.client.consentAccepted,
      },
      status: data.status || 'draft',
      totalAmount: data.totalAmount || 0,
      currency: data.currency || 'NGN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    saveAppointment(appointment)
    const platform = await syncWithPlatform({ action: 'sync_appointment', payload: appointment })

    res.status(201).json({
      status: true,
      message: 'Appointment created successfully',
      data: {
        ...appointment,
        platform,
      },
    })
  } catch (error) {
    console.error('Error creating appointment:', error)
    res.status(500).json({
      status: false,
      message: 'Error creating appointment',
      error: error.message,
    })
  }
}
