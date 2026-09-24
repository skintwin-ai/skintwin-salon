/**
 * Update Appointment API Endpoint
 * PUT /api/appointments/update
 */

import { parseRequestBody } from '../../utils/http'
import { getAppointment, saveAppointment } from '../_store'
import { syncWithPlatform } from '../integrations/skintwin-sync'

export default async function updateAppointment(req, res) {
  if (req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method not allowed' })
  }

  try {
    const data = parseRequestBody(req)

    if (!data.id) {
      return res.status(400).json({
        status: false,
        message: 'Appointment ID is required',
      })
    }

    const validStatuses = [
      'draft',
      'scheduled',
      'payment_pending',
      'paid',
      'completed',
      'cancelled',
      'no_show',
    ]
    if (data.status && !validStatuses.includes(data.status)) {
      return res.status(400).json({
        status: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      })
    }

    const existing = getAppointment(data.id) || { id: data.id }
    const updatedAppointment = {
      ...existing,
      ...(data.services && { services: data.services }),
      ...(data.date && { date: data.date }),
      ...(data.startTime && { startTime: data.startTime }),
      ...(data.endTime && { endTime: data.endTime }),
      ...(data.providerId && { providerId: data.providerId }),
      ...(data.roomId && { roomId: data.roomId }),
      ...(data.status && { status: data.status }),
      ...(data.notes && { notes: data.notes }),
      updatedAt: new Date().toISOString(),
    }

    saveAppointment(updatedAppointment)
    const platform = await syncWithPlatform({
      action: 'sync_appointment',
      payload: updatedAppointment,
    })

    res.status(200).json({
      status: true,
      message: 'Appointment updated successfully',
      data: {
        ...updatedAppointment,
        platform,
      },
    })
  } catch (error) {
    console.error('Error updating appointment:', error)
    res.status(500).json({
      status: false,
      message: 'Error updating appointment',
      error: error.message,
    })
  }
}
