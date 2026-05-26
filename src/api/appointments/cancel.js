/**
 * Cancel Appointment API Endpoint
 * POST /api/appointments/cancel
 */

export default async function cancelAppointment(req, res) {
  if (req.method !== 'POST') {
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

    // In real implementation, would fetch appointment and check current status
    // For now, simulate validation

    // Check cancellation policy (e.g., 24 hours before)
    const cancellationReason = data.reason || 'Client requested cancellation'
    const refundEligible = data.refundEligible !== false // Default to true

    // Check if appointment can be cancelled
    const appointmentStatus = data.currentStatus || 'scheduled'
    const nonCancellableStatuses = ['completed', 'cancelled', 'no_show']

    if (nonCancellableStatuses.includes(appointmentStatus)) {
      return res.status(400).json({
        status: false,
        message: `Cannot cancel appointment with status: ${appointmentStatus}`,
      })
    }

    // Process refund if appointment was paid
    let refundStatus = null
    if (appointmentStatus === 'paid' && refundEligible) {
      refundStatus = {
        initiated: true,
        amount: data.refundAmount || data.totalAmount,
        method: 'original_payment_method',
        estimatedCompletion: '3-5 business days',
      }
    }

    const cancelledAppointment = {
      id: data.id,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancellationReason,
      cancelledBy: data.cancelledBy || 'client',
      refund: refundStatus,
    }

    res.status(200).json({
      status: true,
      message: 'Appointment cancelled successfully',
      data: cancelledAppointment,
    })
  } catch (error) {
    console.error('Error cancelling appointment:', error)
    res.status(500).json({
      status: false,
      message: 'Error cancelling appointment',
      error: error.message,
    })
  }
}
