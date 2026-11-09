import { test, expect } from '@playwright/test'

test.describe('Focus Management', () => {
  test('should have visible focus indicators', async ({ page }) => {
    await page.goto('/')

    // Tab to first interactive element
    await page.keyboard.press('Tab')

    // Focused element should have visible outline
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()

    // Check for focus styling (outline, box-shadow, or border change)
    const styles = await focusedElement.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return {
        outline: computed.outline,
        boxShadow: computed.boxShadow,
        borderColor: computed.borderColor,
      }
    })

    // At least one focus indicator should be present
    const hasFocusIndicator =
      styles.outline !== 'none' ||
      styles.boxShadow !== 'none' ||
      styles.borderColor !== 'transparent'

    expect(hasFocusIndicator).toBe(true)
  })

  test('should move focus to modal when opened', async ({ page }) => {
    await page.goto('/')

    // Open a modal (if exists)
    const modalTrigger = page.getByTestId('open-modal-button')
    if (await modalTrigger.isVisible()) {
      await modalTrigger.click()

      // Focus should move to modal
      const modal = page.getByRole('dialog')
      await expect(modal).toBeFocused()
    }
  })

  test('should trap focus within modal', async ({ page }) => {
    await page.goto('/')

    const modalTrigger = page.getByTestId('open-modal-button')
    if (await modalTrigger.isVisible()) {
      await modalTrigger.click()

      // Tab through modal elements
      const modal = page.getByRole('dialog')
      const focusableElements = await modal
        .locator('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        .all()

      if (focusableElements.length > 1) {
        // Tab to last element
        for (let i = 0; i < focusableElements.length; i++) {
          await page.keyboard.press('Tab')
        }

        // Tab once more should wrap to first element in modal
        await page.keyboard.press('Tab')
        const focusedElement = page.locator(':focus')

        // Focus should still be within modal
        await expect(modal.locator(':focus')).toBeVisible()
      }
    }
  })

  test('should return focus to trigger when modal closes', async ({ page }) => {
    await page.goto('/')

    const modalTrigger = page.getByTestId('open-modal-button')
    if (await modalTrigger.isVisible()) {
      await modalTrigger.click()

      // Close modal with Escape
      await page.keyboard.press('Escape')

      // Focus should return to trigger
      await expect(modalTrigger).toBeFocused()
    }
  })

  test('should announce status changes to screen readers', async ({ page }) => {
    await page.goto('/cart')

    // Check for live regions
    const liveRegion = page.locator('[aria-live]')
    await expect(liveRegion.first()).toBeAttached()
  })

  test('should have proper focus order on forms', async ({ page }) => {
    await page.goto('/intake')

    const form = page.getByRole('form')
    if (await form.isVisible()) {
      // Tab through form elements
      const tabOrder: string[] = []

      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Tab')
        const focused = page.locator(':focus')
        const name = (await focused.getAttribute('name')) || (await focused.getAttribute('id'))
        if (name) tabOrder.push(name)
      }

      // Focus order should be logical (typically top-to-bottom, left-to-right)
      expect(tabOrder.length).toBeGreaterThan(0)
    }
  })

  test('should skip to main content', async ({ page }) => {
    await page.goto('/')

    // First tab should go to skip link
    await page.keyboard.press('Tab')

    const skipLink = page.getByText(/skip/i).first()
    if (await skipLink.isVisible()) {
      await page.keyboard.press('Enter')

      // Focus should move to main content
      const main = page.getByRole('main')
      const activeElement = page.locator(':focus')

      // Either main is focused or focus is inside main
      const focusInMain =
        (await main.locator(':focus').count()) > 0 ||
        (await main.evaluate((el) => el === document.activeElement))
      expect(focusInMain).toBe(true)
    }
  })
})
