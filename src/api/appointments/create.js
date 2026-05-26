/**
 * Create Appointment API Endpoint
 * POST /api/appointments/create
 */

import crypto from 'crypto'

export default async function createAppointment(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method not allowed' })
  }

  try {
    const data = JSON.parse(req.body)

    // Validate required fields
    const requiredFields = ['services', 'date', 'startTime', 'providerId', 'client']
    for (const field of requiredFields) {
      if (!data[field]) {
        return res.status(400).json({
          status: false,
          message: `Missing required field: ${field}`,
        })
      }
    }

    // Validate services array
    if (!Array.isArray(data.services) || data.services.length === 0) {
      return res.status(400).json({
        status: false,
        message: 'At least one service is required',
      })
    }

    // Validate client consent
    if (!data.client.consentAccepted) {
      return res.status(400).json({
        status: false,
        message: 'Client consent is required',
      })
    }

    // Generate appointment ID and reference using crypto for secure unique IDs
    const appointmentId = `APT_${Date.now()}_${crypto.randomUUID().split('-')[0]}`
    const reference = `REF_${Date.now()}`

    // Create appointment object
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
      status: 'draft',
      totalAmount: data.totalAmount || 0,
      currency: data.currency || 'NGN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // In a real implementation, this would save to a database
    // For now, we return the created appointment

    res.status(201).json({
      status: true,
      message: 'Appointment created successfully',
      data: appointment,
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
