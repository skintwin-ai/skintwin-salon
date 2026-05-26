import React from 'react'
import { Link } from 'gatsby'
import { Layout } from '../components'
import { useBooking } from '../context/booking-context'

import '../components/Confirmation/confirmation.scss'

const ConfirmationPage = () => {
  const { services, appointment, client, checkout, resetBooking } = useBooking()

  // Calculate total duration and price
  const totalDuration = services.reduce((sum, s) => {
    return sum + (s.durationMinutes || 0) + (s.bufferMinutes || 0)
  }, 0)

  const totalPrice = services.reduce((sum, s) => sum + s.price * s.quantity, 0)

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not scheduled'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-NG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const handleNewBooking = () => {
    resetBooking()
  }

  return (
    <Layout>
      <main className="confirmation" role="main" aria-labelledby="confirmation-heading">
        <div className="confirmation__header">
          <div className="confirmation__icon" aria-hidden="true">
            ✓
          </div>
          <h1 id="confirmation-heading" className="confirmation__title">
            Booking Confirmed!
          </h1>
          <p className="confirmation__subtitle">
            Your appointment has been successfully booked. We&apos;ve sent a confirmation to your
            email.
          </p>
        </div>

        <div className="confirmation__details">
          <section className="confirmation__section" aria-labelledby="appointment-details">
            <h2 id="appointment-details" className="confirmation__section-title">
              Appointment Details
            </h2>

            <dl className="confirmation__list">
              <div className="confirmation__item">
                <dt>Confirmation Number</dt>
                <dd data-testid="confirmation-number">
                  {checkout.invoiceId || `APT-${Date.now()}`}
                </dd>
              </div>

              <div className="confirmation__item">
                <dt>Date</dt>
                <dd data-testid="confirmation-date">{formatDate(appointment.date)}</dd>
              </div>

              <div className="confirmation__item">
                <dt>Time</dt>
                <dd data-testid="confirmation-time">
                  {appointment.startTime || 'Not scheduled'} - {appointment.endTime || ''}
                </dd>
              </div>

              {appointment.providerId && (
                <div className="confirmation__item">
                  <dt>Provider</dt>
                  <dd data-testid="confirmation-provider">{appointment.providerId}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="confirmation__section" aria-labelledby="services-heading">
            <h2 id="services-heading" className="confirmation__section-title">
              Services
            </h2>

            <ul className="confirmation__services" data-testid="confirmation-services">
              {services.map((service) => (
                <li key={service.id} className="confirmation__service">
                  <span className="confirmation__service-name">
                    {service.name}
                    {service.quantity > 1 && ` (x${service.quantity})`}
                  </span>
                  <span className="confirmation__service-details">
                    {service.durationMinutes} min • {formatCurrency(service.price * service.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="confirmation__totals">
              <div className="confirmation__total-row">
                <span>Total Duration</span>
                <span data-testid="confirmation-duration">{totalDuration} minutes</span>
              </div>
              <div className="confirmation__total-row confirmation__total-row--final">
                <span>Total Paid</span>
                <span data-testid="confirmation-total">{formatCurrency(totalPrice)}</span>
              </div>
            </div>
          </section>

          <section className="confirmation__section" aria-labelledby="client-heading">
            <h2 id="client-heading" className="confirmation__section-title">
              Client Information
            </h2>

            <dl className="confirmation__list">
              <div className="confirmation__item">
                <dt>Name</dt>
                <dd data-testid="confirmation-client-name">
                  {client.firstName} {client.lastName}
                </dd>
              </div>

              <div className="confirmation__item">
                <dt>Email</dt>
                <dd data-testid="confirmation-email">{client.email}</dd>
              </div>

              <div className="confirmation__item">
                <dt>Phone</dt>
                <dd data-testid="confirmation-phone">{client.phone}</dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="confirmation__actions">
          <button
            type="button"
            className="confirmation__action confirmation__action--secondary"
            onClick={() => window.print()}
          >
            Print Receipt
          </button>

          <Link
            to="/"
            className="confirmation__action confirmation__action--primary"
            onClick={handleNewBooking}
            data-testid="new-booking-button"
          >
            Book Another Appointment
          </Link>
        </div>

        <div className="confirmation__info">
          <h3>Important Information</h3>
          <ul>
            <li>Please arrive 10 minutes before your scheduled appointment time.</li>
            <li>If you need to reschedule or cancel, please contact us at least 24 hours in advance.</li>
            <li>A confirmation email has been sent to {client.email}.</li>
          </ul>
        </div>
      </main>
    </Layout>
  )
}

export default ConfirmationPage

export const Head = () => <title>Booking Confirmed | SkinTwin Salon</title>
