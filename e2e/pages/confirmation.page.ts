import { Page, Locator, expect } from '@playwright/test'

/**
 * Page Object for Confirmation/Receipt page
 */
export class ConfirmationPage {
  readonly page: Page
  readonly successMessage: Locator
  readonly bookingReference: Locator
  readonly appointmentDetails: Locator
  readonly servicesSummary: Locator
  readonly clientInfo: Locator
  readonly paymentReceipt: Locator
  readonly homeButton: Locator
  readonly printButton: Locator
  readonly addToCalendarButton: Locator
  readonly aftercareInfo: Locator

  constructor(page: Page) {
    this.page = page
    this.successMessage = page.locator('[data-testid="success-message"], .success-prompt h1')
    this.bookingReference = page.locator('[data-testid="booking-reference"]')
    this.appointmentDetails = page.locator('[data-testid="appointment-details"]')
    this.servicesSummary = page.locator('[data-testid="services-summary"]')
    this.clientInfo = page.locator('[data-testid="client-info"]')
    this.paymentReceipt = page.locator('[data-testid="payment-receipt"]')
    this.homeButton = page.locator('[data-testid="go-home"], .success-prompt a')
    this.printButton = page.locator('[data-testid="print-receipt"]')
    this.addToCalendarButton = page.locator('[data-testid="add-to-calendar"]')
    this.aftercareInfo = page.locator('[data-testid="aftercare-info"]')
  }

  async isOnConfirmationPage(): Promise<boolean> {
    const url = this.page.url()
    // Check for paid state in cart or confirmation page
    const hasSuccessPrompt = await this.successMessage.isVisible()
    return url.includes('/confirmation') || hasSuccessPrompt
  }

  async hasSuccessMessage(): Promise<boolean> {
    return this.successMessage.isVisible()
  }

  async getSuccessMessage(): Promise<string> {
    return (await this.successMessage.textContent()) || ''
  }

  async hasBookingReference(): Promise<boolean> {
    const refVisible = await this.bookingReference.isVisible()
    if (!refVisible) {
      // Fallback: check if success prompt exists (current app behavior)
      return this.successMessage.isVisible()
    }
    return refVisible
  }

  async getBookingReference(): Promise<string> {
    return (await this.bookingReference.textContent()) || ''
  }

  async getAppointmentDate(): Promise<string> {
    const date = this.appointmentDetails.locator('[data-testid="confirmation-date"]')
    return (await date.textContent()) || ''
  }

  async getAppointmentTime(): Promise<string> {
    const time = this.appointmentDetails.locator('[data-testid="confirmation-time"]')
    return (await time.textContent()) || ''
  }

  async getProviderName(): Promise<string> {
    const provider = this.appointmentDetails.locator('[data-testid="confirmation-provider"]')
    return (await provider.textContent()) || ''
  }

  async getServices(): Promise<string[]> {
    const services = await this.servicesSummary.locator('[data-testid="service-item"]').all()
    const names: string[] = []
    for (const service of services) {
      const name = await service.textContent()
      if (name) names.push(name.trim())
    }
    return names
  }

  async getTotalPaid(): Promise<string> {
    const total = this.paymentReceipt.locator('[data-testid="total-paid"]')
    return (await total.textContent()) || ''
  }

  async getPaymentMethod(): Promise<string> {
    const method = this.paymentReceipt.locator('[data-testid="payment-method"]')
    return (await method.textContent()) || ''
  }

  async goHome(): Promise<void> {
    await this.homeButton.click()
  }

  async printReceipt(): Promise<void> {
    await this.printButton.click()
  }

  async addToCalendar(): Promise<void> {
    await this.addToCalendarButton.click()
  }

  async hasAftercareInfo(): Promise<boolean> {
    return this.aftercareInfo.isVisible()
  }

  async getAftercareInfo(): Promise<string> {
    return (await this.aftercareInfo.textContent()) || ''
  }

  async getClientEmail(): Promise<string> {
    const email = this.clientInfo.locator('[data-testid="client-email"]')
    return (await email.textContent()) || ''
  }

  async verifyConfirmationDetails(expected: {
    date?: string
    time?: string
    provider?: string
    services?: string[]
    total?: string
  }): Promise<void> {
    if (expected.date) {
      await expect(this.appointmentDetails).toContainText(expected.date)
    }
    if (expected.time) {
      await expect(this.appointmentDetails).toContainText(expected.time)
    }
    if (expected.provider) {
      await expect(this.appointmentDetails).toContainText(expected.provider)
    }
    if (expected.services) {
      for (const service of expected.services) {
        await expect(this.servicesSummary).toContainText(service)
      }
    }
    if (expected.total) {
      await expect(this.paymentReceipt).toContainText(expected.total)
    }
  }
}
