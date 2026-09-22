import { describe, expect, it } from 'vitest'
import { isLocalPaystackRail, localPaystackInvoice, localPaystackTerminal } from './paystack-rail'

describe('local Paystack rail', () => {
  it('is used when the secret is missing or a placeholder', () => {
    const previous = process.env.GATSBY_AUTH_KEY
    process.env.GATSBY_AUTH_KEY = 'placeholder'
    expect(isLocalPaystackRail()).toBe(true)
    process.env.GATSBY_AUTH_KEY = 'sk_live_real_secret_value'
    expect(isLocalPaystackRail()).toBe(false)
    process.env.GATSBY_AUTH_KEY = previous
  })

  it('creates and accepts a local invoice', () => {
    const invoice = localPaystackInvoice({
      customer: 'adaeze.obi@example.com',
      line_items: [{ name: 'Facial', amount: 250000, quantity: 1 }],
    })
    expect(invoice.data.id.startsWith('INV_LOCAL_')).toBe(true)
    expect(localPaystackTerminal(invoice.data).data.status).toBe('success')
  })
})
