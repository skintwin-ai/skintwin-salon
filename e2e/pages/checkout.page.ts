import { Page, Locator, expect } from '@playwright/test'

/**
 * Page Object for Checkout page
 */
export class CheckoutPage {
  readonly page: Page
  readonly bookingSummary: Locator
  readonly serviceList: Locator
  readonly appointmentDetails: Locator
  readonly clientDetails: Locator
  readonly totalPrice: Locator
  readonly checkoutButton: Locator
  readonly retryButton: Locator
  readonly cancelButton: Locator
  readonly paymentStatus: Locator
  readonly paymentPrompt: Locator
  readonly errorMessage: Locator
  readonly loadingSpinner: Locator

  constructor(page: Page) {
    this.page = page
    this.bookingSummary = page.locator('[data-testid="booking-summary"], .cart')
    this.serviceList = page.locator('[data-testid="service-list"], .menu-list')
    this.appointmentDetails = page.locator('[data-testid="appointment-details"]')
    this.clientDetails = page.locator('[data-testid="client-details"]')
    this.totalPrice = page.locator('[data-testid="total-price"], .receipt__total')
    this.checkoutButton = page.locator('[data-testid="checkout-button"], .receipt__checkout button')
    this.retryButton = page.locator('[data-testid="retry-button"]')
    this.cancelButton = page.locator('[data-testid="cancel-button"]')
    this.paymentStatus = page.locator('[data-testid="payment-status"], .pill')
    this.paymentPrompt = page.locator('[data-testid="payment-prompt"], .menu-list__prompt')
    this.errorMessage = page.locator('[data-testid="error-message"]')
    this.loadingSpinner = page.locator('[data-testid="loading"], .spinner')
  }

  async goto(): Promise<void> {
    await this.page.goto('/cart')
    await this.page.waitForLoadState('networkidle')
  }

  async isOnCheckoutPage(): Promise<boolean> {
    const url = this.page.url()
    return url.includes('/cart') || url.includes('/checkout')
  }

  async getServices(): Promise<string[]> {
    const services = await this.serviceList.locator('[data-testid="service-item"], .menu__description h4').all()
    const names: string[] = []
    for (const service of services) {
      const name = await service.textContent()
      if (name) names.push(name.trim())
    }
    return names
  }

  async getTotalPrice(): Promise<string> {
    return (await this.totalPrice.textContent())?.trim() || ''
  }

  async getAppointmentDate(): Promise<string> {
    const date = this.appointmentDetails.locator('[data-testid="appointment-date"]')
    return (await date.textContent()) || ''
  }

  async getAppointmentTime(): Promise<string> {
    const time = this.appointmentDetails.locator('[data-testid="appointment-time"]')
    return (await time.textContent()) || ''
  }

  async getProviderName(): Promise<string> {
    const provider = this.appointmentDetails.locator('[data-testid="provider-name"]')
    return (await provider.textContent()) || ''
  }

  async clickCheckout(): Promise<void> {
    await expect(this.checkoutButton).toBeEnabled()
    await this.checkoutButton.click()
  }

  async clickRetry(): Promise<void> {
    await expect(this.retryButton).toBeVisible()
    await this.retryButton.click()
  }

  async clickCancel(): Promise<void> {
    await this.cancelButton.click()
  }

  async getPaymentStatus(): Promise<string> {
    return (await this.paymentStatus.textContent())?.trim() || ''
  }

  async isPaymentInProgress(): Promise<boolean> {
    const isDisabled = await this.checkoutButton.isDisabled()
    const hasSpinner = await this.loadingSpinner.isVisible()
    return isDisabled || hasSpinner
  }

  async hasPaymentPrompt(): Promise<boolean> {
    return this.paymentPrompt.isVisible()
  }

  async getPaymentPromptText(): Promise<string> {
    return (await this.paymentPrompt.textContent()) || ''
  }

  async hasRetryButton(): Promise<boolean> {
    return this.retryButton.isVisible()
  }

  async hasErrorMessage(): Promise<boolean> {
    return this.errorMessage.isVisible()
  }

  async getErrorMessage(): Promise<string> {
    return (await this.errorMessage.textContent()) || ''
  }

  async isCheckoutButtonEnabled(): Promise<boolean> {
    return this.checkoutButton.isEnabled()
  }

  async waitForPaymentStatus(status: string, timeout: number = 30000): Promise<void> {
    await expect(this.paymentStatus).toContainText(status, { timeout })
  }

  async removeService(serviceId: string): Promise<void> {
    const removeButton = this.serviceList.locator(`[data-testid="remove-service-${serviceId}"]`)
    await removeButton.click()
  }

  async editBooking(): Promise<void> {
    const editButton = this.page.locator('[data-testid="edit-booking"]')
    await editButton.click()
  }
}
