import { Page, Locator, expect } from '@playwright/test'

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
    this.serviceCards = page.locator('[data-testid="service-card"], .product')
    this.bookingButton = page.locator('[data-testid="proceed-to-booking"], .nav__cart')
    this.bookingCount = page.locator('[data-testid="booking-count"], .nav__cart span')
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

  async addServiceToBooking(serviceId: string): Promise<void> {
    const addButton = this.page.locator(
      `[data-testid="add-service-${serviceId}"], .product:has([data-id="${serviceId}"]) .product-meta__cart, .product:nth-child(${serviceId}) .product-meta__cart`
    )
    await addButton.click()
  }

  async getBookingCount(): Promise<number> {
    const text = await this.bookingCount.textContent()
    return parseInt(text || '0', 10)
  }

  async proceedToBooking(): Promise<void> {
    await this.bookingButton.click()
  }

  async filterByCategory(category: string): Promise<void> {
    const filter = this.categoryFilters.locator(`[data-category="${category}"]`)
    await filter.click()
  }

  async searchServices(query: string): Promise<void> {
    await this.searchInput.fill(query)
    await this.page.waitForTimeout(300) // debounce
  }

  async getServicePrice(serviceId: string): Promise<string> {
    const priceElement = this.page.locator(
      `[data-testid="service-${serviceId}"] .service-price, .product:nth-child(${serviceId}) .product-meta__price`
    )
    return (await priceElement.textContent()) || ''
  }

  async getServiceDuration(serviceId: string): Promise<string> {
    const durationElement = this.page.locator(`[data-testid="service-${serviceId}"] .service-duration`)
    return (await durationElement.textContent()) || ''
  }

  async isServiceAvailable(serviceId: string): Promise<boolean> {
    const addButton = this.page.locator(`[data-testid="add-service-${serviceId}"]`)
    return addButton.isEnabled()
  }

  async viewServiceDetails(serviceId: string): Promise<void> {
    const serviceCard = this.page.locator(`[data-testid="service-card-${serviceId}"]`)
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
