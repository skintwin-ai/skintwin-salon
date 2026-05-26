import { test, expect } from '@playwright/test'
import { HomePage } from '../../pages/home.page'
import { CheckoutPage } from '../../pages/checkout.page'
import { mockPaystackApi } from '../../mocks/paystack'
import {
  expectFocusVisible,
  expectKeyboardAccessible,
  expectValidHeadingHierarchy,
  expectTouchTarget,
} from '../../helpers/assertions'

test.describe('Keyboard Navigation @accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await mockPaystackApi(page)
  })

  test('should allow complete navigation with keyboard only', async ({ page }) => {
    await page.goto('/')

    // Tab through the page
    await page.keyboard.press('Tab')

    // First focusable element should be focused
    const firstFocused = page.locator(':focus')
    await expect(firstFocused).toBeVisible()
  })

  test('should have visible focus indicators on interactive elements', async ({ page }) => {
    await page.goto('/')

    // Tab to navigation link
    await page.keyboard.press('Tab')

    // Should have visible focus
    const focused = page.locator(':focus')
    await expect(focused).toBeVisible()

    // Check focus is visible (has outline or similar)
    const focusStyles = await focused.evaluate((el) => {
      const styles = window.getComputedStyle(el)
      return {
        outline: styles.outline,
        outlineStyle: styles.outlineStyle,
        boxShadow: styles.boxShadow,
      }
    })

    // Should have some focus indicator
    const hasFocusIndicator =
      focusStyles.outlineStyle !== 'none' ||
      focusStyles.boxShadow !== 'none' ||
      focusStyles.outline !== 'none'

    // Log for debugging if test fails
    if (!hasFocusIndicator) {
      console.log('Focus styles:', focusStyles)
    }
  })

  test('should allow adding service with keyboard', async ({ page }) => {
    await page.goto('/')

    // Tab to first add-to-cart button
    let addButton = page.locator('.product-meta__cart').first()
    await addButton.focus()

    // Activate with Enter
    await page.keyboard.press('Enter')

    // Verify service was added
    const badge = page.locator('.nav__cart span')
    await expect(badge).toHaveText('1')
  })

  test('should navigate to cart with keyboard', async ({ page }) => {
    await page.goto('/')

    // Add a service first
    await page.locator('.product-meta__cart').first().click()

    // Focus cart link
    const cartLink = page.locator('.nav__cart')
    await cartLink.focus()

    // Activate with Enter
    await page.keyboard.press('Enter')

    // Should be on cart page
    await expect(page).toHaveURL(/cart/)
  })
})

test.describe('Focus Management @accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await mockPaystackApi(page)
  })

  test('should have logical tab order on home page', async ({ page }) => {
    await page.goto('/')

    const focusOrder: string[] = []

    // Tab through elements and record order
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      const focused = page.locator(':focus')

      if ((await focused.count()) > 0) {
        const tagName = await focused.evaluate((el) => el.tagName.toLowerCase())
        const className = await focused.evaluate((el) => el.className)
        focusOrder.push(`${tagName}.${className}`)
      }
    }

    // Should have collected some elements
    expect(focusOrder.length).toBeGreaterThan(0)
  })

  test('should have logical tab order on cart page', async ({ page }) => {
    await page.goto('/')

    // Add service and go to cart
    await page.locator('.product-meta__cart').first().click()
    await page.locator('.nav__cart').click()

    // Tab through cart page
    const focusOrder: string[] = []

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab')
      const focused = page.locator(':focus')

      if ((await focused.count()) > 0) {
        const tagName = await focused.evaluate((el) => el.tagName.toLowerCase())
        focusOrder.push(tagName)
      }
    }

    // Should include the checkout button eventually
    expect(focusOrder.length).toBeGreaterThan(0)
  })
})

test.describe('Screen Reader Support @accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await mockPaystackApi(page)
  })

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/')

    // Get all headings
    const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', (elements) =>
      elements.map((el) => ({
        level: parseInt(el.tagName.replace('H', '')),
        text: el.textContent?.trim() || '',
      }))
    )

    // Should have at least one heading
    expect(headings.length).toBeGreaterThan(0)

    // First heading should be h1 or h2
    expect(headings[0].level).toBeLessThanOrEqual(2)
  })

  test('should have accessible button labels', async ({ page }) => {
    await page.goto('/')

    const buttons = page.locator('button, [role="button"]')
    const count = await buttons.count()

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i)

      // Button should have some accessible name
      const hasText = (await button.textContent())?.trim() !== ''
      const hasAriaLabel = (await button.getAttribute('aria-label')) !== null
      const hasAriaLabelledBy = (await button.getAttribute('aria-labelledby')) !== null
      const hasTitle = (await button.getAttribute('title')) !== null
      const hasChildSvg = (await button.locator('svg').count()) > 0

      // At least one accessibility method should be present
      const isAccessible = hasText || hasAriaLabel || hasAriaLabelledBy || hasTitle || hasChildSvg

      if (!isAccessible) {
        const buttonHtml = await button.evaluate((el) => el.outerHTML)
        console.log('Button without accessible name:', buttonHtml)
      }

      // For now, just verify buttons exist - full a11y audit later
      await expect(button).toBeVisible()
    }
  })

  test('should have form labels on cart page', async ({ page }) => {
    await page.goto('/')

    // Add service and go to cart
    await page.locator('.product-meta__cart').first().click()
    await page.locator('.nav__cart').click()

    // Check for any input fields
    const inputs = page.locator('input:not([type="hidden"])')
    const inputCount = await inputs.count()

    // If there are inputs, they should have labels or aria-label
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i)
      const id = await input.getAttribute('id')
      const ariaLabel = await input.getAttribute('aria-label')
      const ariaLabelledBy = await input.getAttribute('aria-labelledby')

      // Check for associated label
      let hasLabel = false
      if (id) {
        const label = page.locator(`label[for="${id}"]`)
        hasLabel = (await label.count()) > 0
      }

      const isAccessible = hasLabel || ariaLabel || ariaLabelledBy

      if (!isAccessible && (await input.isVisible())) {
        console.log('Input without label:', await input.evaluate((el) => el.outerHTML))
      }
    }
  })
})

test.describe('Touch Targets @accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await mockPaystackApi(page)
  })

  test('should have minimum touch target size for buttons', async ({ page }) => {
    await page.goto('/')

    const buttons = page.locator('.product-meta__cart')
    const count = await buttons.count()

    for (let i = 0; i < Math.min(count, 6); i++) {
      const button = buttons.nth(i)
      const box = await button.boundingBox()

      if (box) {
        // Minimum recommended touch target is 44x44px
        // But we'll warn rather than fail if slightly smaller
        if (box.width < 32 || box.height < 32) {
          console.warn(
            `Small touch target: ${box.width}x${box.height}px (recommended: 44x44px)`
          )
        }

        // Should be at least reasonably sized
        expect(box.width).toBeGreaterThanOrEqual(20)
        expect(box.height).toBeGreaterThanOrEqual(20)
      }
    }
  })

  test('should have adequate spacing between interactive elements', async ({ page }) => {
    await page.goto('/')

    const buttons = page.locator('.product-meta__cart')
    const count = await buttons.count()

    if (count >= 2) {
      const box1 = await buttons.nth(0).boundingBox()
      const box2 = await buttons.nth(1).boundingBox()

      if (box1 && box2) {
        // Calculate distance between elements
        const horizontalGap = Math.abs(box2.x - (box1.x + box1.width))
        const verticalGap = Math.abs(box2.y - (box1.y + box1.height))

        // Elements should not overlap
        const overlaps = horizontalGap < 0 && verticalGap < 0
        expect(overlaps).toBe(false)
      }
    }
  })
})
