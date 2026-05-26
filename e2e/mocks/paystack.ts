import { Page, Route } from '@playwright/test'

/**
 * Mock Paystack API responses for E2E tests
 */

interface InvoiceResponse {
  status: boolean
  message: string
  data: {
    id: string
    offline_reference: string
    amount: number
    currency: string
    status: string
    customer: {
      email: string
      customer_code: string
    }
  }
}

interface TerminalResponse {
  status: boolean
  message: string
  data?: {
    id: string
  }
}

export async function mockPaystackApi(page: Page): Promise<void> {
  // Mock invoice creation
  await page.route('**/api/create_invoice', async (route: Route) => {
    const response: InvoiceResponse = {
      status: true,
      message: 'Invoice created',
      data: {
        id: 'PRQ_mock_' + Date.now(),
        offline_reference: 'OFF_mock_' + Date.now(),
        amount: 850000,
        currency: 'NGN',
        status: 'pending',
        customer: {
          email: 'test@example.com',
          customer_code: 'CUS_mock123',
        },
      },
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    })
  })

  // Mock terminal push
  await page.route('**/api/push_to_terminal', async (route: Route) => {
    const response: TerminalResponse = {
      status: true,
      message: 'Event sent to Terminal',
      data: {
        id: 'EVT_mock_' + Date.now(),
      },
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    })
  })
}

export async function mockPaystackApiError(page: Page): Promise<void> {
  await page.route('**/api/create_invoice', async (route: Route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        status: false,
        message: 'An error occurred while processing your request',
      }),
    })
  })
}

export async function mockPaystackApiTimeout(page: Page, delayMs: number = 30000): Promise<void> {
  await page.route('**/api/create_invoice', async (route: Route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    await route.abort('timedout')
  })
}

export async function mockTerminalError(page: Page): Promise<void> {
  await page.route('**/api/push_to_terminal', async (route: Route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        status: false,
        message: 'Terminal not available',
      }),
    })
  })
}

/**
 * Simulate payment success via Pusher event
 */
export async function simulatePaymentSuccess(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Dispatch custom event to simulate Pusher payment success
    window.dispatchEvent(
      new CustomEvent('pusher:payment', {
        detail: {
          event: 'paymentrequest.success',
          data: {
            status: 'success',
            reference: 'PAY_mock_success',
          },
        },
      })
    )

    // Also try to call the Pusher mock callback if available
    const mockPusher = (window as { mockPusher?: { triggerEvent: (event: string, data: unknown) => void } }).mockPusher
    if (mockPusher) {
      mockPusher.triggerEvent('paymentrequest.success', {
        status: 'success',
        reference: 'PAY_mock_success',
      })
    }
  })
}

/**
 * Simulate payment failure via Pusher event
 */
export async function simulatePaymentFailure(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Dispatch custom event to simulate Pusher payment failure
    window.dispatchEvent(
      new CustomEvent('pusher:payment', {
        detail: {
          event: 'paymentrequest.failed',
          data: {
            status: 'failed',
            message: 'Payment was declined',
          },
        },
      })
    )

    // Also try to call the Pusher mock callback if available
    const mockPusher = (window as { mockPusher?: { triggerEvent: (event: string, data: unknown) => void } }).mockPusher
    if (mockPusher) {
      mockPusher.triggerEvent('paymentrequest.failed', {
        status: 'failed',
        message: 'Payment was declined',
      })
    }
  })
}
