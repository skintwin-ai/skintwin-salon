function isPlaceholderKey(key) {
  if (!key) return true
  const normalized = String(key).trim().toLowerCase()
  return (
    normalized === 'placeholder' ||
    normalized === 'changeme' ||
    normalized.includes('your_key') ||
    normalized.includes('your-key') ||
    /sk_test_placeholder|pk_test_placeholder/.test(normalized)
  )
}

export function isLocalPaystackRail() {
  return isPlaceholderKey(process.env.GATSBY_AUTH_KEY)
}

export function localPaystackInvoice(payload = {}) {
  const id = `INV_LOCAL_${Date.now()}`
  return {
    status: true,
    message: 'Local Paystack invoice created',
    data: {
      id,
      offline_reference: `OFF_${id}`,
      status: 'pending',
      customer: payload.customer || null,
      description: payload.description || 'Salon booking',
      line_items: payload.line_items || [],
    },
  }
}

export function localPaystackTerminal(invoice = {}) {
  return {
    status: true,
    message: 'Local Paystack terminal accepted invoice',
    data: {
      id: invoice.id,
      reference: invoice.offline_reference || invoice.reference,
      status: 'success',
    },
  }
}
