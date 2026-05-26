import { Page, Route } from '@playwright/test'
import services from '../fixtures/services.json'
import providers from '../fixtures/providers.json'
import availability from '../fixtures/availability.json'

/**
 * Mock SkinTwin AI platform API for E2E tests
 */

export async function mockSkinTwinApi(page: Page): Promise<void> {
  // Mock services endpoint
  await page.route('**/api/services**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: true,
        data: services,
      }),
    })
  })

  // Mock providers endpoint
  await page.route('**/api/providers**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: true,
        data: providers,
      }),
    })
  })

  // Mock availability endpoint
  await page.route('**/api/availability**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: true,
        data: availability,
      }),
    })
  })

  // Mock appointment creation
  await page.route('**/api/appointments/create', async (route: Route) => {
    const request = route.request()
    const postData = request.postDataJSON()

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: true,
        message: 'Appointment created successfully',
        data: {
          id: 'APT_' + Date.now(),
          ...postData,
          status: 'draft',
          createdAt: new Date().toISOString(),
        },
      }),
    })
  })

  // Mock appointment update
  await page.route('**/api/appointments/update', async (route: Route) => {
    const request = route.request()
    const postData = request.postDataJSON()

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: true,
        message: 'Appointment updated successfully',
        data: {
          ...postData,
          updatedAt: new Date().toISOString(),
        },
      }),
    })
  })

  // Mock appointment cancellation
  await page.route('**/api/appointments/cancel', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: true,
        message: 'Appointment cancelled successfully',
      }),
    })
  })

  // Mock client lookup
  await page.route('**/api/clients/lookup**', async (route: Route) => {
    const url = new URL(route.request().url())
    const email = url.searchParams.get('email')

    if (email === 'adaeze.obi@example.com') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: true,
          data: {
            id: 'clt-001',
            firstName: 'Adaeze',
            lastName: 'Obi',
            email: 'adaeze.obi@example.com',
            phone: '+2348012345678',
            consentAccepted: true,
            intakeCompleted: true,
          },
        }),
      })
    } else {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          status: false,
          message: 'Client not found',
        }),
      })
    }
  })

  // Mock client creation
  await page.route('**/api/clients/create', async (route: Route) => {
    const request = route.request()
    const postData = request.postDataJSON()

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: true,
        message: 'Client created successfully',
        data: {
          id: 'clt_' + Date.now(),
          ...postData,
          createdAt: new Date().toISOString(),
        },
      }),
    })
  })

  // Mock intake submission
  await page.route('**/api/clients/intake', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: true,
        message: 'Intake form submitted successfully',
      }),
    })
  })

  // Mock platform sync
  await page.route('**/api/integrations/sync**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: true,
        message: 'Synced with SkinTwin platform',
      }),
    })
  })
}

export async function mockSkinTwinApiError(page: Page, endpoint: string): Promise<void> {
  await page.route(`**/api/${endpoint}**`, async (route: Route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        status: false,
        message: 'Internal server error',
      }),
    })
  })
}
