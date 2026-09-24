import { describe, expect, it } from 'vitest'
import { handleSalonApi } from './local-salon-rail.js'

describe('local salon API rail', () => {
  it('creates a Paystack invoice, accepts the terminal, and syncs the booking', async () => {
    const invoice = await handleSalonApi('POST', '/api/create_invoice', {
      customer: 'adaeze.obi@example.com',
      line_items: [{ name: 'Signature Facial', amount: 250000, quantity: 1 }],
    })
    expect(invoice.status).toBe(200)
    expect(invoice.body.data.id.startsWith('INV_LOCAL_')).toBe(true)

    const terminal = await handleSalonApi('POST', '/api/push_to_terminal', invoice.body.data)
    expect(terminal.body.data.status).toBe('success')

    const sync = await handleSalonApi('POST', '/api/integrations/skintwin', {
      action: 'sync_appointment',
      appointment: {
        id: invoice.body.data.id,
        date: '2026-09-22',
        startTime: '10:00',
        status: 'paid',
        client: { email: 'adaeze.obi@example.com' },
        services: [{ id: 'srv-001', name: 'Signature Facial' }],
      },
    })
    expect(sync.body.status).toBe(true)
    expect(sync.body.data.persisted).toBe(true)
  })
})
