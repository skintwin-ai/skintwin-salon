/**
 * Check Availability API Endpoint
 * GET /api/appointments/availability
 */

import Providers from '../../data/providers.json'
import { listAppointments } from '../_store'
import { weekdayFromDate, timeToMinutes, minutesToTime, slotsOverlap } from '../../utils/booking'

export default async function checkAvailability(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ status: false, message: 'Method not allowed' })
  }

  try {
    const { date, providerId, durationMinutes = 60 } = req.query

    if (!date) {
      return res.status(400).json({
        status: false,
        message: 'Date parameter is required',
      })
    }

    const dayOfWeek = weekdayFromDate(date)
    const duration = parseInt(durationMinutes, 10) || 60

    const providersToCheck = providerId
      ? Providers.filter((provider) => provider.id === providerId)
      : Providers

    if (providersToCheck.length === 0) {
      return res.status(404).json({
        status: false,
        message: 'Provider not found',
      })
    }

    const booked = listAppointments().filter(
      (appointment) =>
        appointment.date === date &&
        appointment.status !== 'cancelled' &&
        appointment.status !== 'no_show'
    )

    const availability = {}

    for (const provider of providersToCheck) {
      const dayAvailability = provider.availability[dayOfWeek]

      if (!dayAvailability) {
        availability[provider.id] = {
          available: false,
          reason: 'Provider not available on this day',
          slots: [],
        }
        continue
      }

      const slots = []
      const [startHour, startMin] = dayAvailability.start.split(':').map(Number)
      const [endHour, endMin] = dayAvailability.end.split(':').map(Number)

      let currentMinutes = startHour * 60 + startMin
      const endMinutes = endHour * 60 + endMin
      const providerBookings = booked.filter(
        (appointment) => appointment.providerId === provider.id
      )

      while (currentMinutes + duration <= endMinutes) {
        const time = minutesToTime(currentMinutes)
        const slotEnd = currentMinutes + duration
        const overlapsBooking = providerBookings.some((appointment) => {
          const bookedStart = timeToMinutes(appointment.startTime)
          const bookedEnd = appointment.endTime
            ? timeToMinutes(appointment.endTime)
            : bookedStart + duration
          return slotsOverlap(currentMinutes, slotEnd, bookedStart, bookedEnd)
        })

        slots.push({
          time,
          available: !overlapsBooking,
          endTime: minutesToTime(slotEnd),
        })

        currentMinutes += 30
      }

      availability[provider.id] = {
        available: slots.some((slot) => slot.available),
        provider: {
          id: provider.id,
          name: provider.name,
          title: provider.title,
        },
        date,
        workingHours: dayAvailability,
        slots,
      }
    }

    res.status(200).json({
      status: true,
      data: {
        date,
        durationMinutes: duration,
        availability,
      },
    })
  } catch (error) {
    console.error('Error checking availability:', error)
    res.status(500).json({
      status: false,
      message: 'Error checking availability',
      error: error.message,
    })
  }
}
