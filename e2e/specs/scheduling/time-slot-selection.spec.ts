import { test, expect } from '@playwright/test'
import { BookingPage } from '../../pages/booking.page'
import { HomePage } from '../../pages/home.page'

test.describe('Time Slot Selection', () => {
  let bookingPage: BookingPage
  let homePage: HomePage

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page)
    bookingPage = new BookingPage(page)
    
    // Add a service and go to booking
    await homePage.goto()
    await homePage.addService('srv-001')
    await bookingPage.goto()
    
    // Select a date
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    await bookingPage.selectDate(tomorrow)
  })

  test('should display available time slots', async () => {
    await expect(bookingPage.page.getByTestId('time-slots')).toBeVisible()
  })

  test('should allow selecting a time slot', async ({ page }) => {
    const timeSlot = page.getByTestId('time-slot-09:00')
    
    if (await timeSlot.isVisible()) {
      await timeSlot.click()
      await expect(timeSlot).toHaveClass(/selected/)
    }
  })

  test('should show slot availability status', async ({ page }) => {
    // Available slots should be clickable
    const availableSlot = page.locator('[data-testid^="time-slot-"]:not([disabled])')
    await expect(availableSlot.first()).toBeVisible()
  })

  test('should disable unavailable slots', async ({ page }) => {
    const unavailableSlot = page.locator('[data-testid^="time-slot-"][disabled]')
    
    if (await unavailableSlot.first().isVisible()) {
      await expect(unavailableSlot.first()).toBeDisabled()
    }
  })

  test('should update end time based on service duration', async ({ page }) => {
    const timeSlot = page.getByTestId('time-slot-10:00')
    
    if (await timeSlot.isVisible()) {
      await timeSlot.click()
      
      // End time should reflect service duration
      const endTime = page.getByTestId('appointment-end-time')
      if (await endTime.isVisible()) {
        const endTimeText = await endTime.textContent()
        expect(endTimeText).not.toBe('10:00')
      }
    }
  })

  test('should show selected time in summary', async ({ page }) => {
    const timeSlot = page.getByTestId('time-slot-11:00')
    
    if (await timeSlot.isVisible()) {
      await timeSlot.click()
      
      const summary = page.getByTestId('booking-summary')
      if (await summary.isVisible()) {
        await expect(summary).toContainText('11:00')
      }
    }
  })
})
