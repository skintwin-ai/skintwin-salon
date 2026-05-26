import { test, expect } from '@playwright/test'
import { CheckoutPage } from '../../pages/checkout.page'
import { mockPaystackApi, simulatePaymentSuccess } from '../../mocks/paystack'

test.describe('Payment Success', () => {
  let checkoutPage: CheckoutPage

  test.beforeEach(async ({ page }) => {
    checkoutPage = new CheckoutPage(page)
    
    // Mock Paystack API
    await mockPaystackApi(page)
    
    // Navigate to checkout with items
    await page.goto('/cart')
  })

  test('should transition to success state on payment completion', async ({ page }) => {
    // Start payment
    await checkoutPage.createInvoice()
    await checkoutPage.pushToTerminal()
    
    // Wait for pending state
    await expect(page.getByTestId('payment-status-pending')).toBeVisible()
    
    // Simulate payment success
    await simulatePaymentSuccess(page)
    
    // Should show success state
    await expect(page.getByTestId('payment-status-success')).toBeVisible({ timeout: 10000 })
  })

  test('should show confirmation details after success', async ({ page }) => {
    // Complete payment flow
    await checkoutPage.createInvoice()
    await checkoutPage.pushToTerminal()
    await simulatePaymentSuccess(page)
    
    // Should display confirmation number
    await expect(page.getByTestId('confirmation-number')).toBeVisible()
  })

  test('should display receipt after successful payment', async ({ page }) => {
    await checkoutPage.createInvoice()
    await checkoutPage.pushToTerminal()
    await simulatePaymentSuccess(page)
    
    // Should navigate to confirmation or show receipt
    await expect(page.getByText(/confirmed|receipt/i)).toBeVisible({ timeout: 10000 })
  })

  test('should clear cart after successful payment', async ({ page }) => {
    await checkoutPage.createInvoice()
    await checkoutPage.pushToTerminal()
    await simulatePaymentSuccess(page)
    
    // Navigate to home
    await page.goto('/')
    
    // Cart should be empty
    const cartCount = page.getByTestId('cart-count')
    if (await cartCount.isVisible()) {
      await expect(cartCount).toHaveText('0')
    }
  })
})
