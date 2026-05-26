import { Page, expect } from '@playwright/test'
import { CheckoutPage } from '../pages/checkout.page'
import { ConfirmationPage } from '../pages/confirmation.page'
import { simulatePaymentSuccess, simulatePaymentPending } from '../mocks/pusher'

/**
 * Reusable payment flow helpers for E2E tests
 */

export async function initiatePayment(page: Page): Promise<void> {
  const checkoutPage = new CheckoutPage(page)

  await expect(checkoutPage.isOnCheckoutPage()).resolves.toBe(true)
  await checkoutPage.clickCheckout()
}

export async function waitForPaymentPending(page: Page): Promise<void> {
  const checkoutPage = new CheckoutPage(page)

  // Simulate pending status from terminal
  await simulatePaymentPending(page)
  await expect(checkoutPage.getPaymentStatus()).resolves.toBe('Pending')
  await expect(checkoutPage.isPaymentInProgress()).resolves.toBe(true)
}

export async function completePayment(page: Page): Promise<void> {
  const checkoutPage = new CheckoutPage(page)

  // Simulate successful payment from terminal
  await simulatePaymentSuccess(page)

  // Should redirect to confirmation
  const confirmationPage = new ConfirmationPage(page)
  await expect(confirmationPage.isOnConfirmationPage()).resolves.toBe(true)
}

export async function completeFullPaymentFlow(page: Page): Promise<void> {
  await initiatePayment(page)
  await waitForPaymentPending(page)
  await completePayment(page)
}

export async function verifyPaymentSuccess(page: Page): Promise<void> {
  const confirmationPage = new ConfirmationPage(page)

  await expect(confirmationPage.isOnConfirmationPage()).resolves.toBe(true)
  await expect(confirmationPage.hasSuccessMessage()).resolves.toBe(true)
  await expect(confirmationPage.hasBookingReference()).resolves.toBe(true)
}

export async function verifyPaymentFailure(page: Page): Promise<void> {
  const checkoutPage = new CheckoutPage(page)

  await expect(checkoutPage.getPaymentStatus()).resolves.toBe('Failed')
  await expect(checkoutPage.hasRetryButton()).resolves.toBe(true)
}

export async function retryPayment(page: Page): Promise<void> {
  const checkoutPage = new CheckoutPage(page)

  await checkoutPage.clickRetry()
  await expect(checkoutPage.isPaymentInProgress()).resolves.toBe(false)
}

export function calculateExpectedTotal(serviceIds: string[], services: any[]): number {
  return serviceIds.reduce((total, id) => {
    const service = services.find((s) => s.id === id)
    return total + (service?.price || 0)
  }, 0)
}

export function formatCurrency(amount: number, currency: string = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
  }).format(amount)
}
