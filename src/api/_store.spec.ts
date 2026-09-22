import { describe, it, expect, beforeEach } from 'vitest'
import {
  findClient,
  getClient,
  getAppointment,
  saveClient,
  saveAppointment,
  listAppointments,
  persistSync,
  listSyncs,
  resetStore,
} from './_store'

describe('salon store', () => {
  beforeEach(() => {
    resetStore()
  })

  it('finds seeded clients by email or phone', () => {
    expect(findClient({ email: 'adaeze.obi@example.com' })?.firstName).toBe('Adaeze')
    expect(findClient({ phone: '2348012345678' })?.lastName).toBe('Obi')
    expect(findClient({ email: 'unknown@example.com' })).toBeNull()
    expect(findClient({})).toBeNull()
    expect(getClient('missing')).toBeNull()
    expect(getAppointment('missing')).toBeNull()
  })

  it('persists created clients and appointments', () => {
    saveClient({
      id: 'clt-new',
      firstName: 'Ngozi',
      lastName: 'Eze',
      email: 'ngozi@example.com',
      phone: '+2348099999999',
    })
    expect(findClient({ email: 'ngozi@example.com' })?.id).toBe('clt-new')

    saveAppointment({
      id: 'APT_1',
      date: '2026-09-23',
      startTime: '10:00',
      endTime: '11:15',
      providerId: 'prv-001',
      status: 'draft',
    })
    expect(listAppointments()).toHaveLength(1)
  })

  it('keeps local platform sync payloads', () => {
    persistSync({ id: 'local_1', action: 'sync_client', payload: { externalId: 'clt-001' } })
    expect(listSyncs()).toHaveLength(1)
  })
})
