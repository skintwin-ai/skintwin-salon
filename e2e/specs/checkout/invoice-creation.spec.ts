import { test, expect } from '@playwright/test'
import { HomePage } from '../../pages/home.page'
import { CheckoutPage } from '../../pages/checkout.page'
import { mockPaystackApi, mockPaystackApiError } from '../../mocks/paystack'
import {
  injectPusherMock,
  simulatePaymentSuccess,
  simulatePaymentPending,
} from '../../mocks/pusher'
import { completeFullBookingFlow, defaultTestClient } from '../../helpers/booking-flow'

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
    await completeFullBookingFlow(page, { serviceIds: ['srv-001', 'srv-002'] }, defaultTestClient)

    await expect(page).toHaveURL(/cart/)
    const services = await checkoutPage.getServices()
    expect(services.length).toBe(2)
  })

  test('should display total price', async ({ page }) => {
    await completeFullBookingFlow(page, { serviceIds: ['srv-001'] }, defaultTestClient)

    const total = await checkoutPage.getTotalPrice()
    expect(total).toBeTruthy()
    expect(total).toMatch(/₦|NGN|\d/)
  })

  test('should enable checkout button when services are selected', async ({ page }) => {
    await completeFullBookingFlow(page, { serviceIds: ['srv-001'] }, defaultTestClient)

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

    await completeFullBookingFlow(page, { serviceIds: ['srv-001'] }, defaultTestClient)
  })

  test('should create invoice on checkout', async ({ page }) => {
    const invoicePromise = page.waitForResponse('**/api/create_invoice')
    await checkoutPage.clickCheckout()
    const response = await invoicePromise
    expect(response.status()).toBe(200)
  })

  test('should push to terminal after invoice creation', async ({ page }) => {
    const invoicePromise = page.waitForResponse('**/api/create_invoice')
    const terminalPromise = page.waitForResponse('**/api/push_to_terminal')
    await checkoutPage.clickCheckout()

    const invoiceResponse = await invoicePromise
    expect(invoiceResponse.status()).toBe(200)

    const terminalResponse = await terminalPromise
    expect(terminalResponse.status()).toBe(200)
  })

  test('should disable checkout button during processing', async ({ page }) => {
    await checkoutPage.clickCheckout()
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

    await completeFullBookingFlow(page, { serviceIds: ['srv-001'] }, defaultTestClient)
  })

  test('should show pending status when waiting for payment', async ({ page }) => {
    await checkoutPage.clickCheckout()
    await simulatePaymentPending(page)
    const status = await checkoutPage.getPaymentStatus()
    expect(status.toLowerCase()).toContain('pending')
  })

  test('should show terminal prompt when payment is pending', async ({ page }) => {
    await checkoutPage.clickCheckout()
    await page.waitForTimeout(500)
    const hasPrompt = await checkoutPage.hasPaymentPrompt()
    expect(hasPrompt).toBe(true)
  })

  test('should transition to confirmation on successful payment @smoke', async ({ page }) => {
    await checkoutPage.clickCheckout()
    await simulatePaymentSuccess(page)
    await expect(page).toHaveURL(/confirmation/, { timeout: 5000 })
    await expect(page.locator('[data-testid="payment-success"]')).toBeVisible()
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
    await completeFullBookingFlow(page, { serviceIds: ['srv-001'] }, defaultTestClient)
    await checkoutPage.clickCheckout()
    await page.waitForTimeout(1000)
    await expect(page).toHaveURL(/cart/)
  })
})
