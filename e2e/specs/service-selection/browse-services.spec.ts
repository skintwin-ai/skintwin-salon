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

  test('should display all available services', async () => {
    const serviceCount = await homePage.getServiceCount()
    expect(serviceCount).toBeGreaterThan(0)
  })

  test('should display service cards with name and price', async () => {
    const cards = await homePage.getServiceCards()
    expect(cards.length).toBeGreaterThan(0)

    const firstCard = cards[0]
    await expect(firstCard).toBeVisible()
    await expect(firstCard.locator('[data-testid="service-name"]')).toBeVisible()
    await expect(firstCard.locator('[data-testid="service-price"]')).toBeVisible()
  })

  test('should navigate between home and checkout', async ({ page }) => {
    await page.click('.nav__cart')
    await expect(page).toHaveURL(/cart/)

    await page.click('.nav__brand')
    await expect(page).toHaveURL('/')
  })
})
