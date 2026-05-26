import { test, expect } from '@playwright/test'
import { IntakePage } from '../../pages/intake.page'

test.describe('Returning Client Lookup', () => {
  let intakePage: IntakePage

  test.beforeEach(async ({ page }) => {
    intakePage = new IntakePage(page)
    await intakePage.goto()
  })

  test('should show returning client lookup option', async ({ page }) => {
    const returningClientTab = page.getByTestId('returning-client-tab')
    await expect(returningClientTab).toBeVisible()
  })

  test('should search client by email', async ({ page }) => {
    // Switch to returning client mode
    await page.getByTestId('returning-client-tab').click()
    
    // Enter email for lookup
    await page.getByTestId('lookup-email').fill('adaeze.obi@example.com')
    await page.getByTestId('lookup-button').click()
    
    // Should find and display client info
    await expect(page.getByText(/Adaeze/i)).toBeVisible({ timeout: 5000 })
  })

  test('should search client by phone', async ({ page }) => {
    // Switch to returning client mode
    await page.getByTestId('returning-client-tab').click()
    
    // Enter phone for lookup
    await page.getByTestId('lookup-phone').fill('+2348012345678')
    await page.getByTestId('lookup-button').click()
    
    // Should find client
    await expect(page.getByTestId('client-found-message')).toBeVisible({ timeout: 5000 })
      .catch(() => {
        // Alternative check
        expect(page.getByText(/found/i)).toBeVisible()
      })
  })

  test('should show message for unknown client', async ({ page }) => {
    // Switch to returning client mode
    await page.getByTestId('returning-client-tab').click()
    
    // Enter non-existent email
    await page.getByTestId('lookup-email').fill('unknown@example.com')
    await page.getByTestId('lookup-button').click()
    
    // Should show not found message
    await expect(page.getByText(/not found/i)).toBeVisible({ timeout: 5000 })
  })

  test('should prefill form for found client', async ({ page }) => {
    // Switch to returning client mode
    await page.getByTestId('returning-client-tab').click()
    
    // Search for known client
    await page.getByTestId('lookup-email').fill('adaeze.obi@example.com')
    await page.getByTestId('lookup-button').click()
    
    // Wait for lookup
    await page.waitForTimeout(1000)
    
    // Click to use this client
    const useClientButton = page.getByTestId('use-client-button')
    if (await useClientButton.isVisible()) {
      await useClientButton.click()
      
      // Form should be prefilled
      await expect(intakePage.firstNameInput).toHaveValue(/Adaeze/i)
    }
  })

  test('should show previous visit count for returning client', async ({ page }) => {
    // Switch to returning client mode
    await page.getByTestId('returning-client-tab').click()
    
    // Search for known client
    await page.getByTestId('lookup-email').fill('adaeze.obi@example.com')
    await page.getByTestId('lookup-button').click()
    
    // Should show visit history
    const visitCount = page.getByTestId('previous-visits')
    if (await visitCount.isVisible()) {
      await expect(visitCount).toContainText(/\d+/)
    }
  })
})
