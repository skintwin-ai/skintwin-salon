import { test as base, expect } from '@playwright/test'
import { installSalonE2eMocks } from './mocks/salon-e2e'

export const test = base.extend({
  page: async ({ page }, use) => {
    if (process.env.SALON_E2E_MOCKS !== '0') {
      await installSalonE2eMocks(page)
    }
    await use(page)
  },
})

export { expect }
