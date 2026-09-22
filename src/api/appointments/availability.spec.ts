import { beforeEach, describe, expect, it } from 'vitest'
import checkAvailability from './availability'
import { resetStore, saveAppointment } from '../_store'

function mockRes() {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: unknown) {
      this.body = payload
      return this
    },
  }
  return res
}

describe('availability API', () => {
  beforeEach(() => {
    resetStore()
  })

  it('rejects non-GET methods', async () => {
    const res = mockRes()
    await checkAvailability({ method: 'POST', query: {} }, res)
    expect(res.statusCode).toBe(405)
  })

  it('requires a date', async () => {
    const res = mockRes()
    await checkAvailability({ method: 'GET', query: {} }, res)
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 for an unknown provider', async () => {
    const res = mockRes()
    await checkAvailability(
      { method: 'GET', query: { date: '2026-09-23', providerId: 'missing' } },
      res
    )
    expect(res.statusCode).toBe(404)
  })

  it('returns no slots when the provider is off that day', async () => {
    const res = mockRes()
    await checkAvailability(
      { method: 'GET', query: { date: '2026-09-27', providerId: 'prv-001' } },
      res
    )
    expect(res.statusCode).toBe(200)
    const availability = (
      res.body as {
        data: { availability: Record<string, { slots: unknown[]; available: boolean }> }
      }
    ).data.availability['prv-001']
    expect(availability.available).toBe(false)
    expect(availability.slots).toEqual([])
  })

  it('returns deterministic slots from provider hours without randomness', async () => {
    const res = mockRes()
    await checkAvailability(
      {
        method: 'GET',
        query: { date: '2026-09-23', providerId: 'prv-001', durationMinutes: '60' },
      },
      res
    )

    expect(res.statusCode).toBe(200)
    const slots = (
      res.body as {
        data: { availability: Record<string, { slots: { time: string; available: boolean }[] }> }
      }
    ).data.availability['prv-001'].slots
    expect(slots.length).toBeGreaterThan(0)
    expect(slots.every((slot) => slot.available)).toBe(true)
  })

  it('marks overlapping booked appointments unavailable', async () => {
    saveAppointment({
      id: 'APT_booked',
      date: '2026-09-23',
      startTime: '10:00',
      endTime: '11:00',
      providerId: 'prv-001',
      status: 'scheduled',
    })

    const res = mockRes()
    await checkAvailability(
      {
        method: 'GET',
        query: { date: '2026-09-23', providerId: 'prv-001', durationMinutes: '60' },
      },
      res
    )

    const slots = (
      res.body as {
        data: { availability: Record<string, { slots: { time: string; available: boolean }[] }> }
      }
    ).data.availability['prv-001'].slots
    expect(slots.find((slot) => slot.time === '10:00')?.available).toBe(false)
    expect(slots.find((slot) => slot.time === '09:00')?.available).toBe(true)
  })
})
