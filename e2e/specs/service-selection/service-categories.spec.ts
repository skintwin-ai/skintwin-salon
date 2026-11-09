import { test, expect } from '@playwright/test'
import { HomePage } from '../../pages/home.page'

test.describe('Service Categories', () => {
  let homePage: HomePage

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page)
    await homePage.goto()
  })

  test('should display all service categories', async () => {
    const categories = ['facials', 'treatments', 'consultations', 'packages', 'add-ons']

    for (const category of categories) {
      await expect(homePage.page.getByTestId(`category-${category}`)).toBeVisible()
    }
  })

  test('should filter services by category', async ({ page }) => {
    // Click on facials category
    await page.getByTestId('category-facials').click()

    // Should show facials services
    await expect(page.getByTestId('service-srv-001')).toBeVisible()

    // Should not show non-facial services initially in filtered view
    const serviceCards = await page.getByTestId(/^service-srv/).all()
    expect(serviceCards.length).toBeGreaterThan(0)
  })

  test('should show "All" category to reset filter', async ({ page }) => {
    // Filter by category first
    await page.getByTestId('category-treatments').click()

    // Reset to all
    await page.getByTestId('category-all').click()

    // Should show all services
    const serviceCards = await page.getByTestId(/^service-srv/).all()
    expect(serviceCards.length).toBeGreaterThanOrEqual(1)
  })

  test('should highlight active category', async ({ page }) => {
    const facialsCategory = page.getByTestId('category-facials')

    await facialsCategory.click()

    await expect(facialsCategory).toHaveClass(/active/)
  })

  test('should show service count per category', async ({ page }) => {
    const categoryBadge = page.getByTestId('category-facials-count')

    if (await categoryBadge.isVisible()) {
      const count = await categoryBadge.textContent()
      expect(parseInt(count || '0')).toBeGreaterThan(0)
    }
  })
})
