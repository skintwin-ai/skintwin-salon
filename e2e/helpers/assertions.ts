import { Page, Locator, expect } from '@playwright/test'

/**
 * Custom assertions for E2E tests
 */

export async function expectAccessibleName(locator: Locator, name: string): Promise<void> {
  await expect(locator).toHaveAccessibleName(name)
}

export async function expectFocusVisible(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector)
  await element.focus()

  // Check that focus is visible (element has focus-visible styles)
  const hasFocusOutline = await element.evaluate((el) => {
    const styles = window.getComputedStyle(el)
    return (
      styles.outlineStyle !== 'none' ||
      styles.boxShadow.includes('rgb') ||
      el.matches(':focus-visible')
    )
  })

  expect(hasFocusOutline).toBe(true)
}

export async function expectKeyboardAccessible(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector)

  // Element should be focusable
  await element.focus()
  await expect(element).toBeFocused()

  // Element should be activatable with Enter or Space
  const tagName = await element.evaluate((el) => el.tagName.toLowerCase())
  if (tagName === 'button' || tagName === 'a') {
    // Should respond to keyboard activation
    await expect(element).toBeEnabled()
  }
}

export async function expectAriaLive(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector)
  const ariaLive = await element.getAttribute('aria-live')

  expect(['polite', 'assertive']).toContain(ariaLive)
}

export async function expectValidHeadingHierarchy(page: Page): Promise<void> {
  const headings = await page.$$('h1, h2, h3, h4, h5, h6')
  const levels: number[] = []

  for (const heading of headings) {
    const tagName = await heading.evaluate((el) => el.tagName.toLowerCase())
    const level = parseInt(tagName.replace('h', ''))
    levels.push(level)
  }

  // Check that heading hierarchy is valid (no skipping levels)
  for (let i = 1; i < levels.length; i++) {
    const diff = levels[i] - levels[i - 1]
    expect(diff).toBeLessThanOrEqual(1)
  }

  // Check that there's exactly one h1
  const h1Count = levels.filter((l) => l === 1).length
  expect(h1Count).toBe(1)
}

export async function expectColorContrast(
  page: Page,
  selector: string,
  minRatio: number = 4.5
): Promise<void> {
  const element = page.locator(selector)

  const contrastRatio = await element.evaluate((el) => {
    const styles = window.getComputedStyle(el)
    const bgColor = styles.backgroundColor
    const fgColor = styles.color

    // Parse colors
    const parseColor = (color: string): [number, number, number] => {
      const match = color.match(/\d+/g)
      if (!match) return [0, 0, 0]
      return [parseInt(match[0]), parseInt(match[1]), parseInt(match[2])]
    }

    // Calculate relative luminance
    const getLuminance = ([r, g, b]: [number, number, number]): number => {
      const sRGB = [r, g, b].map((v) => {
        v /= 255
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2]
    }

    const bg = parseColor(bgColor)
    const fg = parseColor(fgColor)

    const bgL = getLuminance(bg)
    const fgL = getLuminance(fg)

    const lighter = Math.max(bgL, fgL)
    const darker = Math.min(bgL, fgL)

    return (lighter + 0.05) / (darker + 0.05)
  })

  expect(contrastRatio).toBeGreaterThanOrEqual(minRatio)
}

export async function expectTouchTarget(page: Page, selector: string, minSize: number = 44): Promise<void> {
  const element = page.locator(selector)
  const box = await element.boundingBox()

  expect(box).not.toBeNull()
  expect(box!.width).toBeGreaterThanOrEqual(minSize)
  expect(box!.height).toBeGreaterThanOrEqual(minSize)
}

export async function expectNoAutoplay(page: Page): Promise<void> {
  const videos = page.locator('video[autoplay]')
  const audios = page.locator('audio[autoplay]')

  await expect(videos).toHaveCount(0)
  await expect(audios).toHaveCount(0)
}

export async function expectReducedMotion(page: Page): Promise<void> {
  // Check if prefers-reduced-motion is respected
  await page.emulateMedia({ reducedMotion: 'reduce' })

  // Get all elements with animations
  const animatedElements = await page.$$('[style*="animation"], [style*="transition"]')

  for (const element of animatedElements) {
    const duration = await element.evaluate((el) => {
      const styles = window.getComputedStyle(el)
      const animationDuration = parseFloat(styles.animationDuration)
      const transitionDuration = parseFloat(styles.transitionDuration)
      return animationDuration + transitionDuration
    })

    // Animations should be minimal or disabled
    expect(duration).toBeLessThanOrEqual(0.001)
  }
}
