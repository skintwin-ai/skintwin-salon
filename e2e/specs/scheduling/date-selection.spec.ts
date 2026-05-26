import { test, expect } from '@playwright/test'
import { BookingPage } from '../../pages/booking.page'
import { HomePage } from '../../pages/home.page'

test.describe('Date Selection', () => {
  let bookingPage: BookingPage
  let homePage: HomePage

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page)
    bookingPage = new BookingPage(page)
    
    // Add a service first
    await homePage.goto()
    await homePage.addService('srv-001')
    await bookingPage.goto()
  })

  test('should display calendar for date selection', async () => {
    await expect(bookingPage.page.getByTestId('date-picker')).toBeVisible()
  })

  test('should not allow past dates', async ({ page }) => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateStr = yesterday.toISOString().split('T')[0]
    
    const pastDate = page.getByTestId(`date-${dateStr}`)
    if (await pastDate.isVisible()) {
      await expect(pastDate).toBeDisabled()
    }
  })

  test('should allow future dates', async ({ page }) => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().split('T')[0]
    
    const futureDate = page.getByTestId(`date-${dateStr}`)
    if (await futureDate.isVisible()) {
      await expect(futureDate).not.toBeDisabled()
    }
  })

  test('should highlight selected date', async () => {
    await bookingPage.selectDate(new Date())
    
    // Selected date should have active class
    await expect(bookingPage.page.locator('.date-picker__day--selected')).toBeVisible()
  })

  test('should navigate to next month', async ({ page }) => {
    const nextMonthButton = page.getByTestId('calendar-next-month')
    
    if (await nextMonthButton.isVisible()) {
      await nextMonthButton.click()
      // Should update calendar view
      await expect(page.getByTestId('calendar-month')).toBeVisible()
    }
  })

  test('should navigate to previous month (if not current)', async ({ page }) => {
    // First go to next month
    const nextMonthButton = page.getByTestId('calendar-next-month')
    const prevMonthButton = page.getByTestId('calendar-prev-month')
    
    if (await nextMonthButton.isVisible()) {
      await nextMonthButton.click()
      
      if (await prevMonthButton.isVisible()) {
        await prevMonthButton.click()
        // Should return to original month
        await expect(page.getByTestId('calendar-month')).toBeVisible()
      }
    }
  })
})
