import React, { useState, useEffect, useContext } from 'react'
import { navigate } from 'gatsby'
import { graphql, useStaticQuery } from 'gatsby'
import { GatsbyImage, getImage } from 'gatsby-plugin-image'

import { BookingContext } from '../../context/booking-context'
import { buildInvoicePayload, formatCurrency, formatDuration } from '../../utils/booking'
import './cart.scss'

const Basket = ({ services, status, client, appointment }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const booking = useContext(BookingContext)
  const selectedClient = client || booking?.client
  const selectedAppointment = appointment || booking?.appointment
  const selectedServices = services || []

  useEffect(() => {
    if (status === 'Pending') {
      setLoading(true)
    }

    if (status === 'Paid' || status === 'Failed') {
      setLoading(false)
    }
  }, [status])

  const data = useStaticQuery(graphql`
    query {
      allFile(filter: { extension: { regex: "/(jpg)|(png)|(jpeg)/" } }) {
        edges {
          node {
            base
            childImageSharp {
              gatsbyImageData(width: 120, placeholder: BLURRED, formats: [AUTO, WEBP, AVIF])
            }
          }
        }
      }
    }
  `)

  const filterImage = (path) => {
    if (!path || !data?.allFile?.edges) return null
    const image = data.allFile.edges.find((edge) => edge.node.base === path)
    return image ? getImage(image.node) : null
  }

  const calculateTotal = () => {
    const total = selectedServices.reduce((acc, service) => {
      return acc + service.price * (service.quantity || 1)
    }, 0)

    return formatCurrency(total)
  }

  const pushToTerminal = (id, offline_reference) => {
    const payload = {
      id,
      offline_reference,
    }

    return fetch('/api/push_to_terminal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((response) => response.json())
      .catch(function (err) {
        return err
      })
  }

  const createInvoice = () => {
    if (!selectedClient?.email) {
      setError('Complete client intake before checkout.')
      return
    }

    setLoading(true)
    setError('')
    booking?.setCheckoutStatus('creating')

    const payload = buildInvoicePayload({
      client: selectedClient,
      services: selectedServices,
      appointment: selectedAppointment,
    })

    fetch('/api/create_invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((data) => data.json())
      .then((response) => {
        const invoice = response.data || {}
        const id = invoice.id
        const offline_reference = invoice.offline_reference
        if (id) {
          booking?.setInvoiceDetails(id, offline_reference || '')
          booking?.setCheckoutStatus('pending')
          return pushToTerminal(id, offline_reference)
        }
        throw new Error(response.message || 'Unable to create invoice')
      })
      .catch(function (err) {
        setError(err.message || 'Unable to create invoice')
        booking?.setCheckoutError(err.message || 'Unable to create invoice')
        setLoading(false)
      })
  }

  return (
    <div className="menu-list" data-testid="service-list">
      {selectedAppointment && (
        <div className="cart__appointment" data-testid="appointment-details">
          <p data-testid="appointment-date">{selectedAppointment.date}</p>
          <p data-testid="appointment-time">
            {selectedAppointment.startTime} – {selectedAppointment.endTime}
          </p>
          <p data-testid="provider-name">{selectedAppointment.providerId}</p>
        </div>
      )}
      {selectedClient && (
        <div className="cart__client" data-testid="client-details">
          <p>
            {selectedClient.firstName} {selectedClient.lastName}
          </p>
          <p>{selectedClient.email}</p>
        </div>
      )}
      {(loading || status === 'Pending') && (
        <div className="menu-list__prompt" data-testid="payment-prompt">
          Kindly complete your payment on the Terminal
        </div>
      )}
      {error && (
        <div className="menu-list__prompt" data-testid="error-message" role="alert">
          {error}
        </div>
      )}
      {selectedServices.map((service) => (
        <div
          key={service.id || service.serviceId}
          className="menu-list__body"
          data-testid="service-item"
        >
          <div className="menu__content">
            <div className="menu__image">
              {filterImage(service.image) && (
                <GatsbyImage
                  image={filterImage(service.image)}
                  alt={service.name}
                  placeholder="blurred"
                />
              )}
            </div>
            <div className="menu__description">
              <h4>{service.name}</h4>
              <span>{formatDuration(service.durationMinutes)}</span>
            </div>
          </div>
          <div className="menu__quantity">
            <span>Qty: {service.quantity || 1}</span>
          </div>
          <div className="menu__price">
            <span>{formatCurrency(service.price * (service.quantity || 1))}</span>
          </div>
        </div>
      ))}
      <div className="receipt">
        <div className="receipt__label">
          <span>
            <strong>Total: </strong>
          </span>
        </div>
        <div className="receipt__total" data-testid="total-price">
          <span>{calculateTotal()}</span>
        </div>
        <div className="receipt__checkout">
          <button
            type="button"
            data-testid="checkout-button"
            onClick={() => createInvoice()}
            disabled={loading || status === 'Pending' || !selectedClient?.email}
          >
            {loading ? <span className="spinner" data-testid="loading"></span> : 'Checkout'}
          </button>
          {status === 'Failed' && (
            <>
              <button type="button" data-testid="retry-button" onClick={() => createInvoice()}>
                Retry payment
              </button>
              <button
                type="button"
                data-testid="retry-payment-button"
                onClick={() => createInvoice()}
              >
                Retry payment
              </button>
            </>
          )}
          <button
            type="button"
            className="receipt__edit"
            data-testid="edit-booking"
            onClick={() => navigate('/booking')}
          >
            Edit booking
          </button>
          <button
            type="button"
            className="visually-hidden"
            data-testid="edit-booking-button"
            onClick={() => navigate('/booking')}
          >
            Edit booking
          </button>
        </div>
      </div>
    </div>
  )
}

export default Basket
