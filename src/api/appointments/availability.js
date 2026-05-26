/**
 * Check Availability API Endpoint
 * GET /api/appointments/availability
 * 
 * Query params:
 * - date: YYYY-MM-DD
 * - providerId: optional provider ID
 * - durationMinutes: required duration
 */

import crypto from 'crypto'
import Providers from '../../data/providers.json'

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

    // Parse the date and get day of week
    const requestDate = new Date(date)
    const dayOfWeek = requestDate.toLocaleDateString('en-US', { weekday: 'lowercase' })

    // Get providers to check
    const providersToCheck = providerId
      ? Providers.filter((p) => p.id === providerId)
      : Providers

    if (providersToCheck.length === 0) {
      return res.status(404).json({
        status: false,
        message: 'Provider not found',
      })
    }

    // Generate time slots for each provider
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

      // Generate time slots
      const slots = []
      const [startHour, startMin] = dayAvailability.start.split(':').map(Number)
      const [endHour, endMin] = dayAvailability.end.split(':').map(Number)
      const duration = parseInt(durationMinutes, 10)

      let currentMinutes = startHour * 60 + startMin
      const endMinutes = endHour * 60 + endMin

      // Generate 30-minute slots
      while (currentMinutes + duration <= endMinutes) {
        const hours = Math.floor(currentMinutes / 60)
        const mins = currentMinutes % 60
        const time = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`

        // Simulate some slots being booked (in real app, would check database)
        // Using crypto for deterministic pseudo-random simulation
        const randomByte = crypto.randomBytes(1)[0]
        const isBooked = randomByte > 178 // ~30% chance of being booked

        slots.push({
          time,
          available: !isBooked,
          endTime: calculateEndTime(time, duration),
        })

        currentMinutes += 30
      }

      availability[provider.id] = {
        available: slots.some((s) => s.available),
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
        durationMinutes: parseInt(durationMinutes, 10),
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

function calculateEndTime(startTime, durationMinutes) {
  const [hours, mins] = startTime.split(':').map(Number)
  const totalMinutes = hours * 60 + mins + durationMinutes
  const endHours = Math.floor(totalMinutes / 60)
  const endMins = totalMinutes % 60
  return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`
}
