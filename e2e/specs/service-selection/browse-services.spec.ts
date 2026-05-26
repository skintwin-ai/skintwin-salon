import { test, expect } from '@playwright/test'
import { HomePage } from '../../pages/home.page'
import { mockPaystackApi } from '../../mocks/paystack'

test.describe('Browse Services @smoke', () => {
  let homePage: HomePage

  test.beforeEach(async ({ page }) => {
    await mockPaystackApi(page)
    homePage = new HomePage(page)
    await homePage.goto()
  })

  test('should display all available services', async ({ page }) => {
    const serviceCount = await homePage.getServiceCount()
    expect(serviceCount).toBeGreaterThan(0)
  })

  test('should display service cards with name and price', async ({ page }) => {
    const cards = await homePage.getServiceCards()
    expect(cards.length).toBeGreaterThan(0)

    // First card should have visible name and price
    const firstCard = cards[0]
    await expect(firstCard).toBeVisible()
    await expect(firstCard.locator('.product__title, [data-testid="service-name"]')).toBeVisible()
    await expect(firstCard.locator('.product-meta__price, [data-testid="service-price"]')).toBeVisible()
  })

  test('should navigate between home and cart', async ({ page }) => {
    // Click on cart link
    await page.click('.nav__cart')
    await expect(page).toHaveURL(/cart/)

    // Navigate back to home
    await page.click('.nav__brand')
    await expect(page).toHaveURL('/')
  })
})

test.describe('Service Categories', () => {
  let homePage: HomePage

  test.beforeEach(async ({ page }) => {
    await mockPaystackApi(page)
    homePage = new HomePage(page)
    await homePage.goto()
  })

  test('should display service categories when available', async ({ page }) => {
    // Check if category filters exist (may not in current implementation)
    const categoryFilters = page.locator('[data-testid="category-filter"]')
    const hasCategories = (await categoryFilters.count()) > 0

    if (hasCategories) {
      const categories = await homePage.getCategories()
      expect(categories.length).toBeGreaterThan(0)
    } else {
      // Skip if categories not implemented yet
      test.skip()
    }
  })

  test('should filter services by category when available', async ({ page }) => {
    const categoryFilters = page.locator('[data-testid="category-filter"]')
    const hasCategories = (await categoryFilters.count()) > 0

    if (hasCategories) {
      await homePage.filterByCategory('facials')
      const cards = await homePage.getServiceCards()
      expect(cards.length).toBeGreaterThan(0)
    } else {
      test.skip()
    }
  })
})
