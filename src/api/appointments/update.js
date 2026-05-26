/**
 * Update Appointment API Endpoint
 * PUT /api/appointments/update
 */

export default async function updateAppointment(req, res) {
  if (req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method not allowed' })
  }

  try {
    const data = JSON.parse(req.body)

    // Validate appointment ID
    if (!data.id) {
      return res.status(400).json({
        status: false,
        message: 'Appointment ID is required',
      })
    }

    // Validate status transitions
    const validStatuses = ['draft', 'scheduled', 'payment_pending', 'paid', 'completed', 'cancelled', 'no_show']
    if (data.status && !validStatuses.includes(data.status)) {
      return res.status(400).json({
        status: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      })
    }

    // Check for reschedule conflicts (in real implementation)
    if (data.date || data.startTime || data.providerId) {
      // Would check for conflicts here
      const hasConflict = false // Simulated check

      if (hasConflict) {
        return res.status(409).json({
          status: false,
          message: 'Time slot is not available. Please choose another time.',
        })
      }
    }

    // Update appointment
    const updatedAppointment = {
      id: data.id,
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

    res.status(200).json({
      status: true,
      message: 'Appointment updated successfully',
      data: updatedAppointment,
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
