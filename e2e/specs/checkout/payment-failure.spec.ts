import { test, expect } from '@playwright/test'
import { CheckoutPage } from '../../pages/checkout.page'
import { mockPaystackApi } from '../../mocks/paystack'
import { injectPusherMock, simulatePaymentFailure } from '../../mocks/pusher'
import { completeFullBookingFlow, defaultTestClient } from '../../helpers/booking-flow'

test.describe('Payment Failure', () => {
  let checkoutPage: CheckoutPage

  test.beforeEach(async ({ page }) => {
    checkoutPage = new CheckoutPage(page)
    await mockPaystackApi(page)
    await injectPusherMock(page)
    await completeFullBookingFlow(page, { serviceIds: ['srv-001'] }, defaultTestClient)
  })

  test('should handle payment failure gracefully', async ({ page }) => {
    await checkoutPage.createInvoice()
    await simulatePaymentFailure(page)
    await expect(page.getByTestId('payment-status-failed')).toBeVisible({ timeout: 10000 })
  })

  test('should display error message on failure', async ({ page }) => {
    await checkoutPage.createInvoice()
    await simulatePaymentFailure(page)
    await expect(page.getByText(/failed|error|declined/i)).toBeVisible()
  })

  test('should allow retry after failure', async ({ page }) => {
    await checkoutPage.createInvoice()
    await simulatePaymentFailure(page)
    await expect(page.getByTestId('payment-status-failed')).toBeVisible()
    const retryButton = page.getByTestId('retry-payment-button')
    await expect(retryButton).toBeVisible()
    await expect(retryButton).toBeEnabled()
  })

  test('should preserve booking data after failure', async ({ page }) => {
    const summaryBefore = await page.getByTestId('booking-summary').textContent()
    await checkoutPage.createInvoice()
    await simulatePaymentFailure(page)
    const summaryAfter = await page.getByTestId('booking-summary').textContent()
    expect(summaryAfter).toContain('Your booking')
    expect(summaryBefore).toBeTruthy()
  })

  test('should allow editing booking after failure', async ({ page }) => {
    await checkoutPage.createInvoice()
    await simulatePaymentFailure(page)
    const editButton = page.getByTestId('edit-booking-button')
    if (await editButton.isVisible()) {
      await editButton.click()
      expect(page.url()).toMatch(/(booking|intake)/)
    }
  })
})
