/**
 * Process-local salon store.
 * Persists appointments, clients, and platform sync payloads for this runtime.
 */

const seedClients = [
  {
    id: 'clt-001',
    firstName: 'Adaeze',
    lastName: 'Obi',
    email: 'adaeze.obi@example.com',
    phone: '+2348012345678',
    consentAccepted: true,
    intakeCompleted: true,
    previousVisits: 5,
    preferredProvider: 'prv-001',
    lastVisit: '2024-01-15',
  },
  {
    id: 'clt-002',
    firstName: 'Folake',
    lastName: 'Adeyemi',
    email: 'folake.adeyemi@example.com',
    phone: '+2348023456789',
    consentAccepted: true,
    intakeCompleted: true,
    previousVisits: 2,
    preferredProvider: null,
    lastVisit: '2024-02-01',
  },
]

const store = global.__SKINTWIN_SALON_STORE__ || {
  clients: new Map(seedClients.map((client) => [client.id, { ...client }])),
  appointments: new Map(),
  syncs: [],
}

global.__SKINTWIN_SALON_STORE__ = store

export function listClients() {
  return Array.from(store.clients.values())
}

export function getClient(id) {
  return store.clients.get(id) || null
}

export function findClient({ email, phone } = {}) {
  const searchEmail = email?.toLowerCase()
  const searchPhone = phone?.replace(/\D/g, '')

  return (
    listClients().find((client) => {
      if (searchEmail && client.email.toLowerCase() === searchEmail) return true
      if (searchPhone && client.phone.replace(/\D/g, '').includes(searchPhone)) return true
      return false
    }) || null
  )
}

export function saveClient(client) {
  store.clients.set(client.id, { ...client })
  return getClient(client.id)
}

export function listAppointments() {
  return Array.from(store.appointments.values())
}

export function getAppointment(id) {
  return store.appointments.get(id) || null
}

export function saveAppointment(appointment) {
  store.appointments.set(appointment.id, { ...appointment })
  return getAppointment(appointment.id)
}

export function persistSync(record) {
  store.syncs.push(record)
  return record
}

export function listSyncs() {
  return [...store.syncs]
}

export function resetStore() {
  store.clients = new Map(seedClients.map((client) => [client.id, { ...client }]))
  store.appointments = new Map()
  store.syncs = []
}
