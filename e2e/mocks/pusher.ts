import { Page } from '@playwright/test'

/**
 * Mock Pusher events for E2E tests
 */

export type PaymentEvent = 'paymentrequest.pending' | 'paymentrequest.success' | 'paymentrequest.failed'

export async function simulatePaymentEvent(page: Page, event: PaymentEvent): Promise<void> {
  await page.evaluate((eventType: PaymentEvent) => {
    // Simulate Pusher channel event
    window.dispatchEvent(
      new CustomEvent('pusher:payment-event', {
        detail: {
          event: eventType,
          data: {
            reference: 'OFF_mock_123',
            amount: 850000,
            currency: 'NGN',
          },
        },
      })
    )

    // Also trigger through Pusher mock if available
    if ((window as any).__PUSHER_MOCK__) {
      ;(window as any).__PUSHER_MOCK__.trigger('my-channel', 'my-event', {
        event: eventType,
      })
    }
  }, event)
}

export async function simulatePaymentSuccess(page: Page): Promise<void> {
  await simulatePaymentEvent(page, 'paymentrequest.success')
}

export async function simulatePaymentPending(page: Page): Promise<void> {
  await simulatePaymentEvent(page, 'paymentrequest.pending')
}

export async function simulatePaymentFailure(page: Page): Promise<void> {
  await simulatePaymentEvent(page, 'paymentrequest.failed')
}

export async function injectPusherMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Mock Pusher constructor
    class MockPusherChannel {
      private handlers: Map<string, Function[]> = new Map()

      bind(event: string, callback: Function): void {
        if (!this.handlers.has(event)) {
          this.handlers.set(event, [])
        }
        this.handlers.get(event)!.push(callback)
      }

      unbind(event?: string): void {
        if (event) {
          this.handlers.delete(event)
        } else {
          this.handlers.clear()
        }
      }

      trigger(event: string, data: unknown): void {
        const handlers = this.handlers.get(event) || []
        handlers.forEach((handler) => handler(data))
      }
    }

    class MockPusher {
      private channels: Map<string, MockPusherChannel> = new Map()

      constructor() {
        ;(window as any).__PUSHER_MOCK__ = this
      }

      subscribe(channelName: string): MockPusherChannel {
        if (!this.channels.has(channelName)) {
          this.channels.set(channelName, new MockPusherChannel())
        }
        return this.channels.get(channelName)!
      }

      unsubscribe(channelName: string): void {
        this.channels.delete(channelName)
      }

      disconnect(): void {
        this.channels.clear()
      }

      trigger(channelName: string, event: string, data: unknown): void {
        const channel = this.channels.get(channelName)
        if (channel) {
          channel.trigger(event, data)
        }
      }
    }

    ;(window as any).Pusher = MockPusher
  })
}
