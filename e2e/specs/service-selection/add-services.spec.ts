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

  test('should add a single service to booking', async () => {
    const initialCount = await homePage.getBookingCount()
    expect(initialCount).toBe(0)

    await homePage.addServiceToBooking('srv-001')

    const newCount = await homePage.getBookingCount()
    expect(newCount).toBe(1)
  })

  test('should add multiple services to booking', async () => {
    await homePage.addServiceToBooking('srv-001')
    await homePage.addServiceToBooking('srv-002')
    await homePage.addServiceToBooking('srv-003')

    const count = await homePage.getBookingCount()
    expect(count).toBe(3)
  })

  test('should allow adding same service multiple times', async () => {
    await homePage.addServiceToBooking('srv-001')
    await homePage.addServiceToBooking('srv-001')

    const count = await homePage.getBookingCount()
    expect(count).toBe(2)
  })

  test('should persist services after page navigation', async ({ page }) => {
    await homePage.addServiceToBooking('srv-001')
    await homePage.addServiceToBooking('srv-002')
    expect(await homePage.getBookingCount()).toBe(2)

    await homePage.proceedToBooking()
    await expect(page).toHaveURL(/booking/)

    await page.click('.nav__brand')
    await expect(page).toHaveURL('/')

    expect(await homePage.getBookingCount()).toBe(2)
  })

  test('should update booking badge when service is added', async ({ page }) => {
    const badge = page.locator('[data-testid="booking-count"]')
    await expect(badge).toHaveText('0')

    await page.locator('[data-testid^="add-service-"]').first().click()

    await expect(badge).toHaveText('1')
  })
})

test.describe('Add Services - Booking Button', () => {
  let homePage: HomePage

  test.beforeEach(async ({ page }) => {
    await mockPaystackApi(page)
    homePage = new HomePage(page)
    await homePage.goto()
  })

  test('should have accessible add-to-booking buttons', async ({ page }) => {
    const buttons = page.locator('[data-testid^="add-service-"]')
    const count = await buttons.count()

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i)
      await expect(button).toBeEnabled()
      const label = await button.getAttribute('aria-label')
      expect(label).toBeTruthy()
    }
  })

  test('should show visual feedback when service is added', async ({ page }) => {
    const button = page.locator('[data-testid^="add-service-"]').first()
    await button.click()

    const badge = page.locator('[data-testid="booking-count"]')
    await expect(badge).toHaveText('1')
  })
})
