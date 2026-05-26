import { Page, Locator, expect } from '@playwright/test'

/**
 * Page Object for Booking/Scheduling page
 */
export class BookingPage {
  readonly page: Page
  readonly calendar: Locator
  readonly timeSlots: Locator
  readonly providerSelector: Locator
  readonly selectedDate: Locator
  readonly selectedTime: Locator
  readonly selectedProvider: Locator
  readonly continueButton: Locator
  readonly backButton: Locator
  readonly bookingSummary: Locator
  readonly totalDuration: Locator

  constructor(page: Page) {
    this.page = page
    this.calendar = page.locator('[data-testid="booking-calendar"]')
    this.timeSlots = page.locator('[data-testid="time-slots"]')
    this.providerSelector = page.locator('[data-testid="provider-selector"]')
    this.selectedDate = page.locator('[data-testid="selected-date"]')
    this.selectedTime = page.locator('[data-testid="selected-time"]')
    this.selectedProvider = page.locator('[data-testid="selected-provider"]')
    this.continueButton = page.locator('[data-testid="continue-to-intake"]')
    this.backButton = page.locator('[data-testid="back-to-services"]')
    this.bookingSummary = page.locator('[data-testid="booking-summary"]')
    this.totalDuration = page.locator('[data-testid="total-duration"]')
  }

  async goto(): Promise<void> {
    await this.page.goto('/booking')
    await this.page.waitForLoadState('networkidle')
  }

  async isOnBookingPage(): Promise<boolean> {
    return this.page.url().includes('/booking')
  }

  async selectDate(date: string): Promise<void> {
    const dayButton = this.calendar.locator(`[data-date="${date}"]`)
    await dayButton.click()
    await expect(this.selectedDate).toContainText(date)
  }

  async selectTimeSlot(time: string): Promise<void> {
    const timeButton = this.timeSlots.locator(`[data-time="${time}"]`)
    await timeButton.click()
    await expect(this.selectedTime).toContainText(time)
  }

  async selectFirstAvailableSlot(): Promise<void> {
    const availableSlot = this.timeSlots.locator('[data-available="true"]').first()
    await availableSlot.click()
  }

  async selectProvider(providerId: string): Promise<void> {
    const providerOption = this.providerSelector.locator(`[data-provider="${providerId}"]`)
    await providerOption.click()
  }

  async getAvailableTimeSlots(): Promise<string[]> {
    const slots = await this.timeSlots.locator('[data-available="true"]').all()
    const times: string[] = []
    for (const slot of slots) {
      const time = await slot.getAttribute('data-time')
      if (time) times.push(time)
    }
    return times
  }

  async getUnavailableTimeSlots(): Promise<string[]> {
    const slots = await this.timeSlots.locator('[data-available="false"]').all()
    const times: string[] = []
    for (const slot of slots) {
      const time = await slot.getAttribute('data-time')
      if (time) times.push(time)
    }
    return times
  }

  async getAvailableProviders(): Promise<string[]> {
    const providers = await this.providerSelector.locator('[data-provider]').all()
    const ids: string[] = []
    for (const provider of providers) {
      const id = await provider.getAttribute('data-provider')
      if (id) ids.push(id)
    }
    return ids
  }

  async isDateAvailable(date: string): Promise<boolean> {
    const dayButton = this.calendar.locator(`[data-date="${date}"]`)
    return dayButton.isEnabled()
  }

  async isTimeSlotAvailable(time: string): Promise<boolean> {
    const timeButton = this.timeSlots.locator(`[data-time="${time}"]`)
    const available = await timeButton.getAttribute('data-available')
    return available === 'true'
  }

  async getTotalDuration(): Promise<string> {
    return (await this.totalDuration.textContent()) || ''
  }

  async getSelectedServices(): Promise<string[]> {
    const services = await this.bookingSummary.locator('[data-service]').all()
    const names: string[] = []
    for (const service of services) {
      const name = await service.textContent()
      if (name) names.push(name.trim())
    }
    return names
  }

  async continueToIntake(): Promise<void> {
    await expect(this.continueButton).toBeEnabled()
    await this.continueButton.click()
  }

  async goBack(): Promise<void> {
    await this.backButton.click()
  }

  async hasConflictWarning(): Promise<boolean> {
    const warning = this.page.locator('[data-testid="conflict-warning"]')
    return warning.isVisible()
  }
}
