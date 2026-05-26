import { Page, Locator, expect } from '@playwright/test'

/**
 * Page Object for Client Intake page
 */
export class IntakePage {
  readonly page: Page
  readonly clientForm: Locator
  readonly firstNameInput: Locator
  readonly lastNameInput: Locator
  readonly emailInput: Locator
  readonly phoneInput: Locator
  readonly consentCheckbox: Locator
  readonly lookupButton: Locator
  readonly lookupEmailInput: Locator
  readonly continueButton: Locator
  readonly backButton: Locator
  readonly errorMessages: Locator
  readonly intakeQuestionnaire: Locator

  constructor(page: Page) {
    this.page = page
    this.clientForm = page.locator('[data-testid="client-form"]')
    this.firstNameInput = page.locator('[data-testid="first-name"], input[name="firstName"]')
    this.lastNameInput = page.locator('[data-testid="last-name"], input[name="lastName"]')
    this.emailInput = page.locator('[data-testid="email"], input[name="email"]')
    this.phoneInput = page.locator('[data-testid="phone"], input[name="phone"]')
    this.consentCheckbox = page.locator('[data-testid="consent-checkbox"], input[type="checkbox"][name="consent"]')
    this.lookupButton = page.locator('[data-testid="lookup-client"]')
    this.lookupEmailInput = page.locator('[data-testid="lookup-email"]')
    this.continueButton = page.locator('[data-testid="continue-to-checkout"]')
    this.backButton = page.locator('[data-testid="back-to-booking"]')
    this.errorMessages = page.locator('[data-testid="error-message"], .error-message')
    this.intakeQuestionnaire = page.locator('[data-testid="intake-questionnaire"]')
  }

  async goto(): Promise<void> {
    await this.page.goto('/intake')
    await this.page.waitForLoadState('networkidle')
  }

  async isOnIntakePage(): Promise<boolean> {
    return this.page.url().includes('/intake')
  }

  async fillClientForm(details: {
    firstName: string
    lastName: string
    email: string
    phone: string
  }): Promise<void> {
    await this.firstNameInput.fill(details.firstName)
    await this.lastNameInput.fill(details.lastName)
    await this.emailInput.fill(details.email)
    await this.phoneInput.fill(details.phone)
  }

  async lookupClient(email: string): Promise<void> {
    await this.lookupEmailInput.fill(email)
    await this.lookupButton.click()
    await this.page.waitForLoadState('networkidle')
  }

  async isClientFound(): Promise<boolean> {
    const foundMessage = this.page.locator('[data-testid="client-found"]')
    return foundMessage.isVisible()
  }

  async isClientPreFilled(): Promise<boolean> {
    const firstName = await this.firstNameInput.inputValue()
    return firstName.length > 0
  }

  async acceptConsent(): Promise<void> {
    await this.consentCheckbox.check()
    await expect(this.consentCheckbox).toBeChecked()
  }

  async isConsentRequired(): Promise<boolean> {
    return this.consentCheckbox.isVisible()
  }

  async getErrorMessages(): Promise<string[]> {
    const errors = await this.errorMessages.all()
    const messages: string[] = []
    for (const error of errors) {
      const text = await error.textContent()
      if (text) messages.push(text.trim())
    }
    return messages
  }

  async hasValidationError(field: string): Promise<boolean> {
    const error = this.page.locator(`[data-testid="error-${field}"], [data-error-for="${field}"]`)
    return error.isVisible()
  }

  async fillIntakeQuestionnaire(answers: Record<string, string>): Promise<void> {
    for (const [question, answer] of Object.entries(answers)) {
      const input = this.intakeQuestionnaire.locator(`[name="${question}"]`)
      await input.fill(answer)
    }
  }

  async continueToCheckout(): Promise<void> {
    await expect(this.continueButton).toBeEnabled()
    await this.continueButton.click()
  }

  async goBack(): Promise<void> {
    await this.backButton.click()
  }

  async isFormValid(): Promise<boolean> {
    const firstName = await this.firstNameInput.inputValue()
    const lastName = await this.lastNameInput.inputValue()
    const email = await this.emailInput.inputValue()
    const phone = await this.phoneInput.inputValue()
    const consent = await this.consentCheckbox.isChecked()

    return firstName.length > 0 && lastName.length > 0 && email.length > 0 && phone.length > 0 && consent
  }

  async clearForm(): Promise<void> {
    await this.firstNameInput.clear()
    await this.lastNameInput.clear()
    await this.emailInput.clear()
    await this.phoneInput.clear()
    await this.consentCheckbox.uncheck()
  }
}
