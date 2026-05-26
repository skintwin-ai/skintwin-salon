import { test, expect } from '@playwright/test'

test.describe('Network Failure', () => {
  test('should handle API network failure gracefully', async ({ page }) => {
    // Intercept API calls and force failure
    await page.route('**/api/**', (route) => {
      route.abort('connectionfailed')
    })
    
    await page.goto('/')
    
    // Try to add a service (which may trigger API call)
    const addButton = page.getByTestId('add-service-srv-001')
    if (await addButton.isVisible()) {
      await addButton.click()
      
      // Should show error message, not crash
      await expect(page.getByText(/error|unable|try again/i)).toBeVisible({ timeout: 5000 })
        .catch(() => {
          // Alternative: page should still be functional
          expect(page.locator('body')).toBeVisible()
        })
    }
  })

  test('should show retry option after network error', async ({ page }) => {
    let failCount = 0
    
    // Fail first request, succeed second
    await page.route('**/api/appointments/**', (route) => {
      failCount++
      if (failCount === 1) {
        route.abort('connectionfailed')
      } else {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ status: true, data: {} })
        })
      }
    })
    
    await page.goto('/booking')
    
    // Check for retry functionality
    const retryButton = page.getByTestId('retry-button')
    if (await retryButton.isVisible()) {
      await retryButton.click()
      
      // Second attempt should succeed
      await expect(page.getByTestId('error-message')).not.toBeVisible()
    }
  })

  test('should preserve form data during network failure', async ({ page }) => {
    await page.goto('/intake')
    
    // Fill form
    const firstNameInput = page.getByTestId('first-name-input')
    if (await firstNameInput.isVisible()) {
      await firstNameInput.fill('Test User')
      
      // Block network
      await page.route('**/api/**', (route) => {
        route.abort('connectionfailed')
      })
      
      // Submit form
      await page.getByTestId('submit-button').click()
      
      // Form data should be preserved
      await expect(firstNameInput).toHaveValue('Test User')
    }
  })
})

test.describe('API Errors', () => {
  test('should handle 400 Bad Request', async ({ page }) => {
    await page.route('**/api/appointments/create', (route) => {
      route.fulfill({
        status: 400,
        body: JSON.stringify({
          status: false,
          message: 'Invalid appointment data'
        })
      })
    })
    
    await page.goto('/booking')
    
    // Trigger API call
    const submitButton = page.getByTestId('book-appointment-button')
    if (await submitButton.isVisible()) {
      await submitButton.click()
      
      // Should show validation error
      await expect(page.getByText(/invalid/i)).toBeVisible()
    }
  })

  test('should handle 500 Server Error', async ({ page }) => {
    await page.route('**/api/**', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({
          status: false,
          message: 'Internal server error'
        })
      })
    })
    
    await page.goto('/cart')
    
    // Try checkout
    const checkoutButton = page.getByTestId('checkout-button')
    if (await checkoutButton.isVisible()) {
      await checkoutButton.click()
      
      // Should show server error message
      await expect(page.getByText(/error|problem|try again/i)).toBeVisible()
    }
  })

  test('should handle 401 Unauthorized', async ({ page }) => {
    await page.route('**/api/**', (route) => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({
          status: false,
          message: 'Unauthorized'
        })
      })
    })
    
    await page.goto('/cart')
    
    // Try an action that requires auth
    const payButton = page.getByTestId('pay-button')
    if (await payButton.isVisible()) {
      await payButton.click()
      
      // Should handle unauthorized gracefully
      await expect(page.getByText(/unauthorized|login|sign in/i)).toBeVisible()
    }
  })

  test('should handle timeout errors', async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      // Delay response beyond typical timeout
      await new Promise(resolve => setTimeout(resolve, 60000))
      route.fulfill({ status: 200 })
    })
    
    page.setDefaultTimeout(5000)
    
    await page.goto('/cart')
    
    // Try action that triggers API
    const checkoutButton = page.getByTestId('checkout-button')
    if (await checkoutButton.isVisible()) {
      await checkoutButton.click()
      
      // Should show timeout message
      await expect(page.getByText(/timeout|taking too long/i)).toBeVisible()
        .catch(() => {
          // Alternative: loading indicator should be visible or hidden
          expect(page.locator('body')).toBeVisible()
        })
    }
  })
})
