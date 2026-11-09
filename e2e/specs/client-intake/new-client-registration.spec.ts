import { test, expect } from '../../extend-test'
import { IntakePage } from '../../pages/intake.page'

test.describe('New Client Registration', () => {
  let intakePage: IntakePage

  test.beforeEach(async ({ page }) => {
    intakePage = new IntakePage(page)
    await intakePage.goto()
  })

  test('should display client registration form', async () => {
    await expect(intakePage.firstNameInput).toBeVisible()
    await expect(intakePage.lastNameInput).toBeVisible()
    await expect(intakePage.emailInput).toBeVisible()
    await expect(intakePage.phoneInput).toBeVisible()
  })

  test('should complete new client registration', async () => {
    await intakePage.fillClientInfo({
      firstName: 'Test',
      lastName: 'Client',
      email: 'test.client@example.com',
      phone: '+2348012345678',
    })

    await intakePage.acceptConsent()
    await intakePage.submitForm()
    await expect(intakePage.page).toHaveURL(/\/cart/, { timeout: 20_000 })
  })

  test('should validate required fields', async () => {
    // Try to submit empty form
    await intakePage.attemptSubmit()

    await expect(intakePage.page.getByTestId('error-firstName')).toBeVisible()
    await expect(intakePage.page.getByTestId('error-email')).toBeVisible()
  })

  test('should validate email format', async ({ page }) => {
    await intakePage.fillClientInfo({
      firstName: 'Test',
      lastName: 'Client',
      email: 'invalid-email',
      phone: '+2348012345678',
    })

    await intakePage.attemptSubmit()

    // Should show email validation error
    await expect(page.getByTestId('error-email')).toBeVisible()
  })

  test('should validate phone format', async ({ page }) => {
    await intakePage.fillClientInfo({
      firstName: 'Test',
      lastName: 'Client',
      email: 'test@example.com',
      phone: '123', // Invalid phone
    })

    await intakePage.attemptSubmit()

    await expect(page.getByTestId('error-phone')).toBeVisible()
  })
})
