import { Page, expect } from '@playwright/test'
import { HomePage } from '../pages/home.page'
import { BookingPage } from '../pages/booking.page'
import { IntakePage } from '../pages/intake.page'
import { CheckoutPage } from '../pages/checkout.page'
import { normalizeServiceId } from './ids'

export { normalizeServiceId }

/**
 * Reusable booking flow helpers for E2E tests
 */

export interface BookingDetails {
  serviceIds: string[]
  providerId?: string
  date?: string
  time?: string
}

export interface ClientDetails {
  firstName: string
  lastName: string
  email: string
  phone: string
  isReturning?: boolean
}

export async function selectServices(page: Page, serviceIds: string[]): Promise<void> {
  const homePage = new HomePage(page)

  for (const serviceId of serviceIds) {
    await homePage.addServiceToBooking(normalizeServiceId(serviceId))
  }

  await expect(homePage.getBookingCount()).resolves.toBe(serviceIds.length)
}

export async function completeScheduling(
  page: Page,
  providerId?: string,
  date?: string,
  time?: string
): Promise<void> {
  const bookingPage = new BookingPage(page)

  const selectedDate = date || getTomorrowDate()
  await bookingPage.selectDate(selectedDate)

  if (providerId) {
    await bookingPage.selectProvider(providerId)
  }

  if (time) {
    await bookingPage.selectTimeSlot(time)
  } else {
    await bookingPage.selectFirstAvailableSlot()
  }

  await bookingPage.continueToIntake()
}

export async function completeIntake(page: Page, client: ClientDetails): Promise<void> {
  const intakePage = new IntakePage(page)

  if (client.isReturning) {
    await intakePage.lookupClient(client.email)
  } else {
    await intakePage.fillClientForm({
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
    })
    await intakePage.acceptConsent()
  }

  await intakePage.continueToCheckout()
}

export async function completeFullBookingFlow(
  page: Page,
  booking: BookingDetails,
  client: ClientDetails
): Promise<void> {
  const homePage = new HomePage(page)
  await homePage.goto()
  await selectServices(page, booking.serviceIds)
  await homePage.proceedToBooking()
  await completeScheduling(page, booking.providerId, booking.date, booking.time)
  await completeIntake(page, client)

  const checkoutPage = new CheckoutPage(page)
  await expect(checkoutPage.isOnCheckoutPage()).resolves.toBe(true)
}

export const defaultTestClient: ClientDetails = {
  firstName: 'Test',
  lastName: 'Client',
  email: 'test.client@example.com',
  phone: '+2348012345678',
}

export function getTomorrowDate(): string {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
    tomorrow.setDate(tomorrow.getDate() + 1)
  }

  return tomorrow.toISOString().split('T')[0]
}

export function getDateInDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}
