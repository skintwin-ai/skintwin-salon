/**
 * Shared salon booking helpers used by pages, checkout, and confirmation.
 */

export function resolveServiceSelections(selections = [], catalog = []) {
  return (selections || [])
    .map((selection) => {
      const service = catalog.find((item) => item.id === selection.serviceId)
      if (!service) return null

      const addOns = (selection.addOns || [])
        .map((addOnId) => catalog.find((item) => item.id === addOnId))
        .filter(Boolean)

      return {
        ...selection,
        id: service.id,
        serviceId: service.id,
        name: service.name,
        durationMinutes: service.durationMinutes,
        bufferMinutes: service.bufferMinutes || 0,
        price: service.price,
        currency: service.currency || 'NGN',
        image: service.image,
        category: service.category,
        quantity: selection.quantity || 1,
        addOnDetails: addOns,
      }
    })
    .filter(Boolean)
}

export function getSelectionTotals(resolved = []) {
  return resolved.reduce(
    (totals, item) => {
      const quantity = item.quantity || 1
      const addOnPrice = (item.addOnDetails || []).reduce((sum, addOn) => sum + addOn.price, 0)
      const addOnDuration = (item.addOnDetails || []).reduce(
        (sum, addOn) => sum + (addOn.durationMinutes || 0),
        0
      )

      return {
        price: totals.price + (item.price + addOnPrice) * quantity,
        duration:
          totals.duration +
          ((item.durationMinutes || 0) + (item.bufferMinutes || 0) + addOnDuration) * quantity,
      }
    },
    { price: 0, duration: 0 }
  )
}

export function formatCurrency(amount, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount || 0)
}

export function formatDuration(minutes) {
  const value = Number(minutes) || 0
  if (value < 60) return `${value} min`
  const hours = Math.floor(value / 60)
  const mins = value % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

export function formatDisplayDate(dateStr) {
  if (!dateStr) return 'Not scheduled'
  const [year, month, day] = String(dateStr).split('-').map(Number)
  if (!year || !month || !day) return dateStr
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.toLocaleDateString('en-NG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function buildInvoicePayload({ client, services, appointment } = {}) {
  const lineItems = (services || []).map((service) => ({
    name: service.name,
    amount: service.price * 100,
    quantity: service.quantity || 1,
  }))

  const clientName =
    [client?.firstName, client?.lastName].filter(Boolean).join(' ') || 'Salon client'
  const when = appointment?.date
    ? ` on ${appointment.date}${appointment.startTime ? ` at ${appointment.startTime}` : ''}`
    : ''

  return {
    customer: client?.email || undefined,
    description: `Salon booking for ${clientName}${when}`,
    line_items: lineItems,
  }
}

export function getServiceCount(selections = []) {
  return (selections || []).reduce((total, item) => total + (item.quantity || 1), 0)
}

export function weekdayFromDate(dateStr) {
  const [year, month, day] = String(dateStr).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
    date.getUTCDay()
  ]
}

export function timeToMinutes(time) {
  const [hours, minutes] = String(time || '00:00')
    .split(':')
    .map(Number)
  return hours * 60 + minutes
}

export function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

export function slotsOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB
}
