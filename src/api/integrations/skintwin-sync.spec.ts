import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetStore, listSyncs } from '../_store'
import {
  syncWithPlatform,
  transformAppointment,
  transformClient,
  transformPayload,
} from './skintwin-sync'

describe('skintwin sync', () => {
  beforeEach(() => {
    resetStore()
    delete process.env.SKINTWIN_API_URL
    delete process.env.SKINTWIN_PLATFORM_KEY
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.SKINTWIN_API_URL
    delete process.env.SKINTWIN_PLATFORM_KEY
  })

  it('transforms appointments and clients without inventing remote ids', () => {
    const appointment = transformAppointment({
      id: 'APT_1',
      startTime: '10:00',
      services: [{ serviceId: 'srv-001', name: 'Signature Facial', category: 'facials' }],
      status: 'paid',
      provider: { id: 'prv-001', name: 'Amara Johnson' },
      client: { id: 'clt-001', email: 'adaeze.obi@example.com' },
    })
    expect(appointment.externalId).toBe('APT_1')
    expect(appointment.status).toBe('confirmed_paid')
    expect(appointment.provider?.name).toBe('Amara Johnson')
    expect(appointment.client?.email).toBe('adaeze.obi@example.com')

    const byProviderId = transformAppointment({
      id: 'APT_2',
      providerId: 'prv-002',
      services: [{ id: 'srv-002', name: 'Deep Cleansing Facial' }],
    })
    expect(byProviderId.provider?.externalId).toBe('prv-002')
    expect(byProviderId.status).toBe('unknown')

    const client = transformClient({
      id: 'clt-001',
      firstName: 'Adaeze',
      email: 'adaeze.obi@example.com',
      consentAccepted: true,
    })
    expect(client.externalId).toBe('clt-001')
    expect(client.profile.firstName).toBe('Adaeze')
  })

  it('persists a local result when the platform key is unset', async () => {
    const result = await syncWithPlatform({
      action: 'sync_appointment',
      payload: { id: 'APT_local', services: [], status: 'draft' },
    })

    expect(result.mode).toBe('local')
    expect(result.synced).toBe(false)
    expect(result.persisted).toBe(true)
    expect(result.skintwinId).toBeNull()
    expect(listSyncs()).toHaveLength(1)
    expect(listSyncs()[0].payload.externalId).toBe('APT_local')
  })

  it('posts to /api/platform/sync when URL and platform key are configured', async () => {
    process.env.SKINTWIN_API_URL = 'https://platform.example'
    process.env.SKINTWIN_PLATFORM_KEY = 'platform-key'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'sk_remote_1' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await syncWithPlatform({
      action: 'sync_client',
      payload: { id: 'clt-001', firstName: 'Adaeze', email: 'adaeze.obi@example.com' },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://platform.example/api/platform/sync',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Bearer stsess\./),
        }),
      })
    )
    expect(result.mode).toBe('remote')
    expect(result.synced).toBe(true)
    expect(result.skintwinId).toBe('sk_remote_1')
  })

  it('keeps the local payload when a configured remote write fails', async () => {
    process.env.SKINTWIN_API_URL = 'https://platform.example'
    process.env.SKINTWIN_PLATFORM_KEY = 'platform-key'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'nope' }),
      })
    )

    const result = await syncWithPlatform({
      action: 'log_treatment',
      payload: { appointmentId: 'APT_1', clientId: 'clt-001', services: [] },
    })

    expect(result.mode).toBe('local')
    expect(result.synced).toBe(false)
    expect(result.persisted).toBe(true)
    expect(result.skintwinId).toBeNull()
  })

  it('keeps the local payload when the remote call throws', async () => {
    process.env.SKINTWIN_API_URL = 'https://platform.example'
    process.env.SKINTWIN_PLATFORM_KEY = 'platform-key'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const result = await syncWithPlatform({
      action: 'get_recommendations',
      payload: { clientId: 'clt-001', concerns: ['dryness'] },
    })

    expect(result.mode).toBe('local')
    expect(result.error).toBe('network down')
    expect(result.skintwinId).toBeNull()
  })

  it('passes unknown actions through as the raw payload', () => {
    expect(transformPayload('unknown', { keep: true })).toEqual({ keep: true })
    expect(transformPayload('unknown')).toEqual({})
  })
})
