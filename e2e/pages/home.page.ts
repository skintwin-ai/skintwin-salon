import { Page, Locator } from '@playwright/test'
import { normalizeServiceId } from '../helpers/ids'

/**
 * Page Object for Home/Service Discovery page
 */
export class HomePage {
  readonly page: Page
  readonly serviceCards: Locator
  readonly bookingButton: Locator
  readonly bookingCount: Locator
  readonly categoryFilters: Locator
  readonly searchInput: Locator

  constructor(page: Page) {
    this.page = page
    this.serviceCards = page.locator('[data-testid^="service-card-"]')
    this.bookingButton = page.locator('[data-testid="proceed-to-booking"]')
    this.bookingCount = page.locator('[data-testid="booking-count"]')
    this.categoryFilters = page.locator('[data-testid="category-filter"]')
    this.searchInput = page.locator('[data-testid="service-search"]')
  }

  async goto(): Promise<void> {
    await this.page.goto('/')
    await this.page.waitForLoadState('networkidle')
  }

  async getServiceCards(): Promise<Locator[]> {
    return this.serviceCards.all()
  }

  async getServiceCount(): Promise<number> {
    return this.serviceCards.count()
  }

  async addService(serviceId: string): Promise<void> {
    return this.addServiceToBooking(serviceId)
  }

  async addServiceToBooking(serviceId: string): Promise<void> {
    const id = normalizeServiceId(serviceId)
    const addButton = this.page.locator(`[data-testid="add-service-${id}"]`)
    await addButton.click()
  }

  async getBookingCount(): Promise<number> {
    const text = await this.bookingCount.textContent()
    return parseInt(text || '0', 10)
  }

  async proceedToBooking(): Promise<void> {
    const continueButton = this.page.locator('[data-testid="proceed-to-booking"]')
    if (await continueButton.count()) {
      await continueButton.click()
      return
    }
    await this.page.goto('/booking')
  }

  async proceedToCheckout(): Promise<void> {
    await this.page.locator('.nav__cart').click()
  }

  async filterByCategory(category: string): Promise<void> {
    const filter = this.categoryFilters.locator(`[data-category="${category}"]`)
    await filter.click()
  }

  async searchServices(query: string): Promise<void> {
    await this.searchInput.fill(query)
    await this.page.waitForTimeout(300)
  }

  async getServicePrice(serviceId: string): Promise<string> {
    const id = normalizeServiceId(serviceId)
    const priceElement = this.page.locator(
      `[data-testid="service-card-${id}"] [data-testid="service-price"]`
    )
    return (await priceElement.textContent()) || ''
  }

  async getServiceDuration(serviceId: string): Promise<string> {
    const id = normalizeServiceId(serviceId)
    const durationElement = this.page.locator(
      `[data-testid="service-card-${id}"] [data-testid="service-duration"]`
    )
    return (await durationElement.textContent()) || ''
  }

  async isServiceAvailable(serviceId: string): Promise<boolean> {
    const id = normalizeServiceId(serviceId)
    const addButton = this.page.locator(`[data-testid="add-service-${id}"]`)
    return addButton.isEnabled()
  }

  async viewServiceDetails(serviceId: string): Promise<void> {
    const id = normalizeServiceId(serviceId)
    const serviceCard = this.page.locator(`[data-testid="service-card-${id}"]`)
    await serviceCard.click()
  }

  async getCategories(): Promise<string[]> {
    const categories = await this.categoryFilters.locator('[data-category]').all()
    const names: string[] = []
    for (const cat of categories) {
      const name = await cat.getAttribute('data-category')
      if (name) names.push(name)
    }
    return names
  }
}
