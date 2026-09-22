import React, { useEffect, useMemo } from 'react'
import { Link } from 'gatsby'
import { Layout } from '../components'
import { useBooking } from '../context/booking-context'
import Services from '../data/services.json'
import Providers from '../data/providers.json'
import {
  formatCurrency,
  formatDisplayDate,
  getSelectionTotals,
  resolveServiceSelections,
} from '../utils/booking'

import '../components/Confirmation/confirmation.scss'

const ConfirmationPage = () => {
  const { services, appointment, client, checkout, resetBooking } = useBooking()

  const resolvedServices = useMemo(() => resolveServiceSelections(services, Services), [services])
  const totals = useMemo(() => getSelectionTotals(resolvedServices), [resolvedServices])
  const provider = Providers.find((item) => item.id === appointment?.providerId)

  useEffect(() => {
    const appointmentId = appointment?.id || checkout.invoiceId
    if (!appointmentId) return

    fetch('/api/integrations/skintwin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sync_appointment',
        appointment: {
          id: appointmentId,
          ...appointment,
          client,
          services: resolvedServices,
          status: 'paid',
        },
      }),
    }).catch((error) => {
      console.error('Confirmation platform sync failed', error)
    })
  }, [appointment, checkout.invoiceId, client, resolvedServices])

  const handleNewBooking = () => {
    resetBooking()
  }

  return (
    <Layout pageTitle="Booking Confirmed">
      <div
        className="confirmation success-prompt"
        aria-labelledby="confirmation-heading"
        data-testid="payment-success"
      >
        <div className="confirmation__header" data-testid="success-message">
          <div className="confirmation__icon" aria-hidden="true">
            ✓
          </div>
          <h1 id="confirmation-heading" className="confirmation__title">
            Booking Confirmed!
          </h1>
          <p className="confirmation__subtitle">
            Your appointment has been booked and payment received. We&apos;ve sent a confirmation to
            your email.
          </p>
        </div>

        <div className="confirmation__details">
          <section
            className="confirmation__section"
            aria-labelledby="appointment-details"
            data-testid="appointment-details"
          >
            <h2 id="appointment-details" className="confirmation__section-title">
              Appointment Details
            </h2>

            <dl className="confirmation__list">
              <div className="confirmation__item">
                <dt>Confirmation Number</dt>
                <dd data-testid="confirmation-number">
                  <span data-testid="booking-reference">
                    {checkout.invoiceId || appointment?.id || 'Pending confirmation'}
                  </span>
                </dd>
              </div>

              <div className="confirmation__item">
                <dt>Date</dt>
                <dd data-testid="confirmation-date">{formatDisplayDate(appointment?.date)}</dd>
              </div>

              <div className="confirmation__item">
                <dt>Time</dt>
                <dd data-testid="confirmation-time">
                  {appointment?.startTime || 'Not scheduled'}
                  {appointment?.endTime ? ` - ${appointment.endTime}` : ''}
                </dd>
              </div>

              {appointment?.providerId && (
                <div className="confirmation__item">
                  <dt>Provider</dt>
                  <dd data-testid="confirmation-provider">
                    {provider?.name || appointment.providerId}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section
            className="confirmation__section"
            aria-labelledby="services-heading"
            data-testid="services-summary"
          >
            <h2 id="services-heading" className="confirmation__section-title">
              Services
            </h2>

            <ul className="confirmation__services" data-testid="confirmation-services">
              {resolvedServices.map((service) => (
                <li
                  key={service.serviceId}
                  className="confirmation__service"
                  data-testid="service-item"
                >
                  <span className="confirmation__service-name">
                    {service.name}
                    {service.quantity > 1 && ` (x${service.quantity})`}
                  </span>
                  <span className="confirmation__service-details">
                    {service.durationMinutes} min •{' '}
                    {formatCurrency(service.price * service.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="confirmation__totals" data-testid="payment-receipt">
              <div className="confirmation__total-row">
                <span>Total Duration</span>
                <span data-testid="confirmation-duration">{totals.duration} minutes</span>
              </div>
              <div className="confirmation__total-row confirmation__total-row--final">
                <span>Total Paid</span>
                <span data-testid="confirmation-total">{formatCurrency(totals.price)}</span>
                <span data-testid="total-paid" className="visually-hidden">
                  {formatCurrency(totals.price)}
                </span>
              </div>
            </div>
          </section>

          <section
            className="confirmation__section"
            aria-labelledby="client-heading"
            data-testid="client-info"
          >
            <h2 id="client-heading" className="confirmation__section-title">
              Client Information
            </h2>

            <dl className="confirmation__list">
              <div className="confirmation__item">
                <dt>Name</dt>
                <dd data-testid="confirmation-client-name">
                  {client?.firstName} {client?.lastName}
                </dd>
              </div>

              <div className="confirmation__item">
                <dt>Email</dt>
                <dd data-testid="confirmation-email">
                  <span data-testid="client-email">{client?.email}</span>
                </dd>
              </div>

              <div className="confirmation__item">
                <dt>Phone</dt>
                <dd data-testid="confirmation-phone">{client?.phone}</dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="confirmation__actions">
          <button
            type="button"
            className="confirmation__action confirmation__action--secondary"
            data-testid="print-receipt"
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
          <Link to="/" className="visually-hidden" data-testid="go-home" onClick={handleNewBooking}>
            Go home
          </Link>
        </div>

        <div className="confirmation__info">
          <h3>Important Information</h3>
          <ul>
            <li>Please arrive 10 minutes before your scheduled appointment time.</li>
            <li>
              If you need to reschedule or cancel, please contact us at least 24 hours in advance.
            </li>
            <li>A confirmation email has been sent to {client?.email || 'your inbox'}.</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}

export default ConfirmationPage
