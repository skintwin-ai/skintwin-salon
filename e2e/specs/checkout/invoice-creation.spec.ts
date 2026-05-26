import { test, expect } from '@playwright/test'
import { HomePage } from '../../pages/home.page'
import { CheckoutPage } from '../../pages/checkout.page'
import { mockPaystackApi, mockPaystackApiError } from '../../mocks/paystack'
import { injectPusherMock, simulatePaymentSuccess, simulatePaymentPending } from '../../mocks/pusher'

test.describe('Checkout Flow @smoke', () => {
  let homePage: HomePage
  let checkoutPage: CheckoutPage

  test.beforeEach(async ({ page }) => {
    await mockPaystackApi(page)
    await injectPusherMock(page)
    homePage = new HomePage(page)
    checkoutPage = new CheckoutPage(page)
  })

  test('should display cart with added services', async ({ page }) => {
    // Add services on home page
    await homePage.goto()
    await homePage.addServiceToBooking('1')
    await homePage.addServiceToBooking('2')

    // Navigate to cart
    await homePage.proceedToBooking()

    // Verify we're on cart page
    await expect(page).toHaveURL(/cart/)

    // Verify services are displayed
    const services = await checkoutPage.getServices()
    expect(services.length).toBe(2)
  })

  test('should display total price', async ({ page }) => {
    // Add services
    await homePage.goto()
    await homePage.addServiceToBooking('1')

    // Navigate to cart
    await homePage.proceedToBooking()

    // Verify total is displayed
    const total = await checkoutPage.getTotalPrice()
    expect(total).toBeTruthy()
    expect(total).toMatch(/₦|NGN|\d/)
  })

  test('should enable checkout button when services are selected', async ({ page }) => {
    // Add service
    await homePage.goto()
    await homePage.addServiceToBooking('1')

    // Navigate to cart
    await homePage.proceedToBooking()

    // Checkout button should be enabled
    const isEnabled = await checkoutPage.isCheckoutButtonEnabled()
    expect(isEnabled).toBe(true)
  })
})

test.describe('Invoice Creation', () => {
  let homePage: HomePage
  let checkoutPage: CheckoutPage

  test.beforeEach(async ({ page }) => {
    await mockPaystackApi(page)
    await injectPusherMock(page)
    homePage = new HomePage(page)
    checkoutPage = new CheckoutPage(page)

    // Setup: Add service and go to cart
    await homePage.goto()
    await homePage.addServiceToBooking('1')
    await homePage.proceedToBooking()
  })

  test('should create invoice on checkout', async ({ page }) => {
    // Listen for API call
    const invoicePromise = page.waitForResponse('**/api/create_invoice')

    // Click checkout
    await checkoutPage.clickCheckout()

    // Verify API was called
    const response = await invoicePromise
    expect(response.status()).toBe(200)
  })

  test('should push to terminal after invoice creation', async ({ page }) => {
    // Listen for both API calls
    const invoicePromise = page.waitForResponse('**/api/create_invoice')
    const terminalPromise = page.waitForResponse('**/api/push_to_terminal')

    // Click checkout
    await checkoutPage.clickCheckout()

    // Verify both APIs were called
    const invoiceResponse = await invoicePromise
    expect(invoiceResponse.status()).toBe(200)

    const terminalResponse = await terminalPromise
    expect(terminalResponse.status()).toBe(200)
  })

  test('should disable checkout button during processing', async ({ page }) => {
    // Click checkout
    await checkoutPage.clickCheckout()

    // Button should be disabled or show loading
    const isInProgress = await checkoutPage.isPaymentInProgress()
    expect(isInProgress).toBe(true)
  })
})

test.describe('Payment Status', () => {
  let homePage: HomePage
  let checkoutPage: CheckoutPage

  test.beforeEach(async ({ page }) => {
    await mockPaystackApi(page)
    await injectPusherMock(page)
    homePage = new HomePage(page)
    checkoutPage = new CheckoutPage(page)

    // Setup: Add service and go to cart
    await homePage.goto()
    await homePage.addServiceToBooking('1')
    await homePage.proceedToBooking()
  })

  test('should show pending status when waiting for payment', async ({ page }) => {
    // Click checkout
    await checkoutPage.clickCheckout()

    // Simulate pending event
    await simulatePaymentPending(page)

    // Should show pending status
    const status = await checkoutPage.getPaymentStatus()
    expect(status.toLowerCase()).toContain('pending')
  })

  test('should show terminal prompt when payment is pending', async ({ page }) => {
    // Click checkout
    await checkoutPage.clickCheckout()

    // Wait for loading state
    await page.waitForTimeout(500)

    // Should show prompt to complete on terminal
    const hasPrompt = await checkoutPage.hasPaymentPrompt()
    expect(hasPrompt).toBe(true)
  })

  test('should transition to paid on successful payment @smoke', async ({ page }) => {
    // Click checkout
    await checkoutPage.clickCheckout()

    // Simulate successful payment
    await simulatePaymentSuccess(page)

    // Should show success state
    await page.waitForTimeout(500)

    // Check for success indicator (receipt or paid status)
    const successIndicator = page.locator('.success-prompt, [data-testid="payment-success"]')
    await expect(successIndicator).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Payment Error Handling', () => {
  let homePage: HomePage
  let checkoutPage: CheckoutPage

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page)
    checkoutPage = new CheckoutPage(page)
  })

  test('should handle API errors gracefully', async ({ page }) => {
    await mockPaystackApiError(page)
    await injectPusherMock(page)

    // Setup
    await homePage.goto()
    await homePage.addServiceToBooking('1')
    await homePage.proceedToBooking()

    // Click checkout (should fail)
    await checkoutPage.clickCheckout()

    // Should not crash the page
    await page.waitForTimeout(1000)
    await expect(page).toHaveURL(/cart/)
  })
})
