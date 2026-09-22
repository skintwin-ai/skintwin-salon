import { describe, it, expect } from 'vitest'
import services from '../data/services.json'
import {
  resolveServiceSelections,
  getSelectionTotals,
  formatCurrency,
  formatDuration,
  formatDisplayDate,
  buildInvoicePayload,
  getServiceCount,
  weekdayFromDate,
  timeToMinutes,
  minutesToTime,
  slotsOverlap,
} from './booking'

describe('resolveServiceSelections', () => {
  it('resolves catalog names, durations, and prices from serviceId', () => {
    const resolved = resolveServiceSelections(
      [{ serviceId: 'srv-001', quantity: 2, addOns: [] }],
      services
    )

    expect(resolved).toHaveLength(1)
    expect(resolved[0].name).toBe('Signature Facial')
    expect(resolved[0].durationMinutes).toBe(60)
    expect(resolved[0].price).toBe(8500)
    expect(resolved[0].quantity).toBe(2)
  })

  it('drops unknown service ids', () => {
    const resolved = resolveServiceSelections(
      [{ serviceId: 'missing', quantity: 1, addOns: [] }],
      services
    )
    expect(resolved).toEqual([])
  })

  it('includes add-on details', () => {
    const resolved = resolveServiceSelections(
      [{ serviceId: 'srv-001', addOns: ['srv-010', 'missing'] }],
      services
    )
    expect(resolved[0].quantity).toBe(1)
    expect(resolved[0].addOnDetails[0].name).toBe('Eye Treatment Add-On')
    const totals = getSelectionTotals(resolved)
    expect(totals.price).toBe(12000)
    expect(totals.duration).toBe(90)
  })
})

describe('getSelectionTotals', () => {
  it('sums price and duration including buffers and quantity', () => {
    const resolved = resolveServiceSelections(
      [{ serviceId: 'srv-001', quantity: 2, addOns: [] }],
      services
    )
    const totals = getSelectionTotals(resolved)
    expect(totals.price).toBe(17000)
    expect(totals.duration).toBe(150)
  })
})

describe('formatters', () => {
  it('formats naira amounts', () => {
    const formatted = formatCurrency(8500)
    expect(formatted).toContain('8,500')
    expect(formatted).toMatch(/₦|NGN/)
  })

  it('formats duration under and over an hour', () => {
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(60)).toBe('1h')
    expect(formatDuration(75)).toBe('1h 15m')
  })

  it('formats ISO dates without timezone shifting the day', () => {
    expect(formatDisplayDate('2026-09-23')).toContain('23')
    expect(formatDisplayDate('')).toBe('Not scheduled')
  })
})

describe('buildInvoicePayload', () => {
  it('invoices the booking client instead of a hard-coded Paystack customer', () => {
    const resolved = resolveServiceSelections(
      [{ serviceId: 'srv-001', quantity: 1, addOns: [] }],
      services
    )
    const payload = buildInvoicePayload({
      client: {
        firstName: 'Adaeze',
        lastName: 'Obi',
        email: 'adaeze.obi@example.com',
      },
      services: resolved,
      appointment: { date: '2026-09-23', startTime: '10:00' },
    })

    expect(payload.customer).toBe('adaeze.obi@example.com')
    expect(payload.description).toContain('Adaeze Obi')
    expect(payload.description).not.toContain('Temi')
    expect(payload.line_items[0]).toEqual({
      name: 'Signature Facial',
      amount: 850000,
      quantity: 1,
    })
  })
})

describe('booking math helpers', () => {
  it('counts selected quantities', () => {
    expect(
      getServiceCount([
        { serviceId: 'srv-001', quantity: 2, addOns: [] },
        { serviceId: 'srv-002', quantity: 1, addOns: [] },
      ])
    ).toBe(3)
  })

  it('maps dates to weekdays in UTC', () => {
    expect(weekdayFromDate('2026-09-23')).toBe('wednesday')
  })

  it('converts times and detects overlaps', () => {
    expect(timeToMinutes('10:30')).toBe(630)
    expect(timeToMinutes('')).toBe(0)
    expect(minutesToTime(630)).toBe('10:30')
    expect(slotsOverlap(600, 660, 630, 690)).toBe(true)
    expect(slotsOverlap(600, 630, 630, 660)).toBe(false)
  })

  it('handles empty or partial booking inputs', () => {
    expect(resolveServiceSelections()).toEqual([])
    expect(getSelectionTotals()).toEqual({ price: 0, duration: 0 })
    expect(getServiceCount()).toBe(0)
    expect(formatCurrency()).toMatch(/₦|NGN|0/)
    expect(formatDuration(0)).toBe('0 min')
    expect(formatDisplayDate('not-a-date')).toBe('not-a-date')

    const payload = buildInvoicePayload({
      client: {},
      services: [{ name: 'Signature Facial', price: 8500 }],
    })
    expect(payload.customer).toBeUndefined()
    expect(payload.description).toContain('Salon client')
    expect(payload.line_items[0].quantity).toBe(1)
  })
})
