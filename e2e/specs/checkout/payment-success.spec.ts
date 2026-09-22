import { test, expect } from '@playwright/test'
import { CheckoutPage } from '../../pages/checkout.page'
import { mockPaystackApi } from '../../mocks/paystack'
import { injectPusherMock, simulatePaymentSuccess } from '../../mocks/pusher'
import { completeFullBookingFlow, defaultTestClient } from '../../helpers/booking-flow'

test.describe('Payment Success', () => {
  let checkoutPage: CheckoutPage

  test.beforeEach(async ({ page }) => {
    checkoutPage = new CheckoutPage(page)
    await mockPaystackApi(page)
    await injectPusherMock(page)
    await completeFullBookingFlow(page, { serviceIds: ['srv-001'] }, defaultTestClient)
  })

  test('should transition to confirmation on payment completion', async ({ page }) => {
    await checkoutPage.createInvoice()
    await simulatePaymentSuccess(page)
    await expect(page).toHaveURL(/confirmation/, { timeout: 10000 })
    await expect(page.getByTestId('payment-success')).toBeVisible()
  })

  test('should show confirmation details after success', async ({ page }) => {
    await checkoutPage.createInvoice()
    await simulatePaymentSuccess(page)
    await expect(page.getByTestId('confirmation-number')).toBeVisible({ timeout: 10000 })
  })

  test('should display receipt after successful payment', async ({ page }) => {
    await checkoutPage.createInvoice()
    await simulatePaymentSuccess(page)
    await expect(page.getByText(/confirmed|receipt/i)).toBeVisible({ timeout: 10000 })
  })

  test('should clear booking after starting a new appointment', async ({ page }) => {
    await checkoutPage.createInvoice()
    await simulatePaymentSuccess(page)
    await page.getByTestId('new-booking-button').click()
    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('booking-count')).toHaveText('0')
  })
})
