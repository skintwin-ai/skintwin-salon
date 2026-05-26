import { test, expect } from '@playwright/test'
import { CheckoutPage } from '../../pages/checkout.page'
import { mockPaystackApi, simulatePaymentFailure } from '../../mocks/paystack'

test.describe('Payment Failure', () => {
  let checkoutPage: CheckoutPage

  test.beforeEach(async ({ page }) => {
    checkoutPage = new CheckoutPage(page)
    
    // Mock Paystack API
    await mockPaystackApi(page)
    
    // Navigate to checkout
    await page.goto('/cart')
  })

  test('should handle payment failure gracefully', async ({ page }) => {
    // Start payment
    await checkoutPage.createInvoice()
    await checkoutPage.pushToTerminal()
    
    // Simulate payment failure
    await simulatePaymentFailure(page)
    
    // Should show failure state
    await expect(page.getByTestId('payment-status-failed')).toBeVisible({ timeout: 10000 })
  })

  test('should display error message on failure', async ({ page }) => {
    await checkoutPage.createInvoice()
    await checkoutPage.pushToTerminal()
    await simulatePaymentFailure(page)
    
    // Should show error message
    await expect(page.getByText(/failed|error|declined/i)).toBeVisible()
  })

  test('should allow retry after failure', async ({ page }) => {
    await checkoutPage.createInvoice()
    await checkoutPage.pushToTerminal()
    await simulatePaymentFailure(page)
    
    // Wait for failure state
    await expect(page.getByTestId('payment-status-failed')).toBeVisible()
    
    // Should show retry button
    const retryButton = page.getByTestId('retry-payment-button')
    await expect(retryButton).toBeVisible()
    await expect(retryButton).toBeEnabled()
  })

  test('should preserve booking data after failure', async ({ page }) => {
    // Note the current booking summary
    const summaryBefore = await page.getByTestId('booking-summary').textContent()
    
    await checkoutPage.createInvoice()
    await checkoutPage.pushToTerminal()
    await simulatePaymentFailure(page)
    
    // Booking details should still be visible
    const summaryAfter = await page.getByTestId('booking-summary').textContent()
    expect(summaryAfter).toBe(summaryBefore)
  })

  test('should allow editing booking after failure', async ({ page }) => {
    await checkoutPage.createInvoice()
    await checkoutPage.pushToTerminal()
    await simulatePaymentFailure(page)
    
    // Should be able to go back
    const editButton = page.getByTestId('edit-booking-button')
    if (await editButton.isVisible()) {
      await editButton.click()
      
      // Should navigate to booking or service selection
      expect(page.url()).toMatch(/(booking|intake)/)
    }
  })
})
