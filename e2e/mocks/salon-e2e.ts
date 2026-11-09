import { Page } from '@playwright/test'

const DEFAULT_SLOTS = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '14:00',
  '14:30',
  '15:00',
].map((time) => ({
  time,
  available: true,
  endTime: time.replace(/^(\d+):(\d+)$/, (_, h, m) => {
    const mins = parseInt(h, 10) * 60 + parseInt(m, 10) + 60
    return `${Math.floor(mins / 60)
      .toString()
      .padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`
  }),
}))

/**
 * Stable Gatsby Function substitutes for CI (gatsby serve + parallel workers).
 */
export async function installSalonE2eMocks(page: Page): Promise<void> {
  await page.route('**/api/appointments/availability**', async (route) => {
    const url = new URL(route.request().url())
    const date = url.searchParams.get('date') || '2026-01-01'
    const providerId = url.searchParams.get('providerId') || 'prv-001'
    const durationMinutes = parseInt(url.searchParams.get('durationMinutes') || '60', 10)

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: true,
        data: {
          date,
          durationMinutes,
          availability: {
            [providerId]: {
              available: true,
              provider: { id: providerId, name: 'Amara Johnson', title: 'Senior Esthetician' },
              date,
              workingHours: { start: '09:00', end: '17:00' },
              slots: DEFAULT_SLOTS,
            },
          },
        },
      }),
    })
  })

  await page.route('**/api/create_invoice', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: true,
        message: 'Invoice created',
        data: {
          id: `PRQ_e2e_${Date.now()}`,
          offline_reference: `OFF_e2e_${Date.now()}`,
          amount: 850000,
          currency: 'NGN',
          status: 'pending',
          customer: { email: 'test.client@example.com', customer_code: 'CUS_e2e' },
        },
      }),
    })
  })

  await page.route('**/api/push_to_terminal', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: true,
        message: 'Event sent to Terminal',
        data: { id: `EVT_e2e_${Date.now()}` },
      }),
    })
  })

  await page.route('**/api/clients/create', async (route) => {
    const postData = route.request().postDataJSON() || {}
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: true,
        data: { id: `clt_e2e_${Date.now()}`, ...postData },
      }),
    })
  })

  await page.route('**/api/clients/intake', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: true, message: 'Intake saved' }),
    })
  })

  await page.route('**/api/appointments/create', async (route) => {
    const postData = route.request().postDataJSON() || {}
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: true,
        data: { id: `apt_e2e_${Date.now()}`, ...postData, status: 'draft' },
      }),
    })
  })

  await page.route('**/api/clients/lookup**', async (route) => {
    const url = new URL(route.request().url())
    const email = url.searchParams.get('email')

    if (email === 'adaeze.obi@example.com' || email === 'test.client@example.com') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: true,
          data: {
            id: 'clt-001',
            firstName: 'Adaeze',
            lastName: 'Obi',
            email: email || 'test.client@example.com',
            phone: '+2348012345678',
            consentAccepted: true,
            intakeCompleted: true,
          },
        }),
      })
      return
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ status: false, message: 'Client not found' }),
    })
  })
}
