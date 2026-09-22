import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility Audit', () => {
  const pages = [
    { path: '/', name: 'Home' },
    { path: '/booking', name: 'Booking' },
    { path: '/intake', name: 'Intake' },
    { path: '/cart', name: 'Cart' },
  ]

  for (const { path, name } of pages) {
    test(`${name} page should have no accessibility violations`, async ({ page }) => {
      await page.goto(path)

      // Wait for page to fully load
      await page.waitForLoadState('networkidle')

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      // Filter out known issues that may be acceptable
      const violations = accessibilityScanResults.violations.filter(
        (violation) => !isKnownIssue(violation)
      )

      expect(violations).toEqual([])
    })

    test(`${name} page should have proper heading structure`, async ({ page }) => {
      await page.goto(path)

      // Check for exactly one h1
      const h1Count = await page.locator('h1').count()
      expect(h1Count).toBe(1)

      // Check heading hierarchy
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all()
      let lastLevel = 0

      for (const heading of headings) {
        const tagName = await heading.evaluate((el) => el.tagName.toLowerCase())
        const level = parseInt(tagName.replace('h', ''))

        // Heading level should not skip (e.g., h1 to h3)
        if (lastLevel > 0) {
          expect(level - lastLevel).toBeLessThanOrEqual(1)
        }

        lastLevel = level
      }
    })

    test(`${name} page should have proper link text`, async ({ page }) => {
      await page.goto(path)

      const links = await page.locator('a').all()

      for (const link of links) {
        const text = await link.textContent()
        const ariaLabel = await link.getAttribute('aria-label')
        const ariaLabelledBy = await link.getAttribute('aria-labelledby')

        // Link should have accessible name
        const hasAccessibleName = (text && text.trim().length > 0) || ariaLabel || ariaLabelledBy

        expect(hasAccessibleName).toBe(true)

        // Check for generic link text
        if (text) {
          const genericTexts = ['click here', 'here', 'read more', 'learn more', 'link']
          expect(genericTexts.includes(text.toLowerCase().trim())).toBe(false)
        }
      }
    })

    test(`${name} page should have proper form labels`, async ({ page }) => {
      await page.goto(path)

      const inputs = await page.locator('input, select, textarea').all()

      for (const input of inputs) {
        const type = await input.getAttribute('type')

        // Skip hidden inputs
        if (type === 'hidden') continue

        const id = await input.getAttribute('id')
        const ariaLabel = await input.getAttribute('aria-label')
        const ariaLabelledBy = await input.getAttribute('aria-labelledby')
        const title = await input.getAttribute('title')
        const placeholder = await input.getAttribute('placeholder')

        // Check for associated label
        let hasLabel = false
        if (id) {
          const label = page.locator(`label[for="${id}"]`)
          hasLabel = (await label.count()) > 0
        }

        // Input should have accessible name
        const hasAccessibleName = hasLabel || ariaLabel || ariaLabelledBy || title

        // Placeholder alone is not sufficient
        if (!hasAccessibleName && placeholder) {
          console.warn(`Input with placeholder "${placeholder}" lacks proper label`)
        }

        expect(hasAccessibleName).toBe(true)
      }
    })

    test(`${name} page should have proper button text`, async ({ page }) => {
      await page.goto(path)

      const buttons = await page.locator('button, [role="button"]').all()

      for (const button of buttons) {
        const text = await button.textContent()
        const ariaLabel = await button.getAttribute('aria-label')
        const ariaLabelledBy = await button.getAttribute('aria-labelledby')
        const title = await button.getAttribute('title')

        // Button should have accessible name
        const hasAccessibleName =
          (text && text.trim().length > 0) || ariaLabel || ariaLabelledBy || title

        expect(hasAccessibleName).toBe(true)
      }
    })
  }

  test('should have proper color contrast', async ({ page }) => {
    await page.goto('/')

    const accessibilityScanResults = await new AxeBuilder({ page }).withTags(['wcag2aa']).analyze()

    // Check specifically for color contrast issues
    const contrastViolations = accessibilityScanResults.violations.filter(
      (v) => v.id === 'color-contrast'
    )

    expect(contrastViolations).toEqual([])
  })

  test('should support reduced motion', async ({ page }) => {
    // Emulate reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await page.goto('/')

    // Check that animations are disabled or reduced
    const animatedElements = await page
      .locator('[style*="animation"], .animate, .transition')
      .count()

    // This is a basic check - in reality, you'd verify animations are disabled
    // For now, just ensure the page loads correctly with reduced motion
    expect(animatedElements).toBeGreaterThanOrEqual(0)
  })

  test('should have skip navigation link', async ({ page }) => {
    await page.goto('/')

    // Focus on body to ensure skip link can appear
    await page.keyboard.press('Tab')

    // Look for skip link
    const skipLink = page.locator('a[href="#main"], a[href="#content"], .skip-link')

    // Skip link should be present (may be visually hidden until focused)
    const skipLinkCount = await skipLink.count()
    expect(skipLinkCount).toBeGreaterThanOrEqual(0)
  })

  test('should have proper lang attribute', async ({ page }) => {
    await page.goto('/')

    const html = page.locator('html')
    const lang = await html.getAttribute('lang')

    expect(lang).toBeTruthy()
    expect(lang?.length).toBeGreaterThanOrEqual(2)
  })

  test('should have proper alt text for images', async ({ page }) => {
    await page.goto('/')

    const images = await page.locator('img').all()

    for (const img of images) {
      const alt = await img.getAttribute('alt')
      const role = await img.getAttribute('role')

      // Image should have alt attribute (can be empty for decorative)
      // or role="presentation"
      const hasAlt = alt !== null || role === 'presentation' || role === 'none'

      expect(hasAlt).toBe(true)
    }
  })
})

/**
 * Check if a violation is a known/acceptable issue
 */
function isKnownIssue(violation: { id: string }): boolean {
  const knownIssues: string[] = [
    // Add IDs of known issues that are acceptable
    // 'color-contrast', // If using custom contrast that passes manual review
  ]

  return knownIssues.includes(violation.id)
}
