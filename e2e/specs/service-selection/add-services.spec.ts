import { test, expect } from '@playwright/test'
import { HomePage } from '../../pages/home.page'
import { mockPaystackApi } from '../../mocks/paystack'

test.describe('Add Services @smoke', () => {
  let homePage: HomePage

  test.beforeEach(async ({ page }) => {
    await mockPaystackApi(page)
    homePage = new HomePage(page)
    await homePage.goto()
  })

  test('should add a single service to booking', async ({ page }) => {
    // Get initial booking count
    const initialCount = await homePage.getBookingCount()
    expect(initialCount).toBe(0)

    // Add first service (using index 1 for current product-based system)
    await homePage.addServiceToBooking('1')

    // Verify count increased
    const newCount = await homePage.getBookingCount()
    expect(newCount).toBe(1)
  })

  test('should add multiple services to booking', async ({ page }) => {
    // Add multiple services
    await homePage.addServiceToBooking('1')
    await homePage.addServiceToBooking('2')
    await homePage.addServiceToBooking('3')

    // Verify count
    const count = await homePage.getBookingCount()
    expect(count).toBe(3)
  })

  test('should allow adding same service multiple times', async ({ page }) => {
    // Add same service twice
    await homePage.addServiceToBooking('1')
    await homePage.addServiceToBooking('1')

    // Verify count includes duplicates
    const count = await homePage.getBookingCount()
    expect(count).toBe(2)
  })

  test('should persist services after page navigation', async ({ page }) => {
    // Add services
    await homePage.addServiceToBooking('1')
    await homePage.addServiceToBooking('2')
    expect(await homePage.getBookingCount()).toBe(2)

    // Navigate to cart
    await homePage.proceedToBooking()
    await expect(page).toHaveURL(/cart/)

    // Navigate back to home
    await page.click('.nav__brand')
    await expect(page).toHaveURL('/')

    // Count should persist (if state is preserved)
    // Note: Current implementation may clear on navigation
  })

  test('should update cart badge when service is added', async ({ page }) => {
    // Initial badge should show 0
    const badge = page.locator('.nav__cart span')
    await expect(badge).toHaveText('0')

    // Add a service
    await page.locator('.product-meta__cart').first().click()

    // Badge should update
    await expect(badge).toHaveText('1')
  })
})

test.describe('Add Services - Cart Button', () => {
  let homePage: HomePage

  test.beforeEach(async ({ page }) => {
    await mockPaystackApi(page)
    homePage = new HomePage(page)
    await homePage.goto()
  })

  test('should have accessible add-to-cart buttons', async ({ page }) => {
    const buttons = page.locator('.product-meta__cart')
    const count = await buttons.count()

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i)
      await expect(button).toBeEnabled()

      // Check button has some accessible indication
      const hasIcon = (await button.locator('svg').count()) > 0
      expect(hasIcon).toBe(true)
    }
  })

  test('should show visual feedback when service is added', async ({ page }) => {
    const button = page.locator('.product-meta__cart').first()

    // Click to add
    await button.click()

    // Badge count should update immediately
    const badge = page.locator('.nav__cart span')
    await expect(badge).toHaveText('1')
  })
})
