import React, { useEffect, useState, useContext, useMemo } from 'react'
import { navigate } from 'gatsby'
import Pusher from 'pusher-js'

import { BookingContext } from '../context/booking-context'
import { Layout, Basket } from '../components'
import Services from '../data/services.json'
import { resolveServiceSelections, getSelectionTotals } from '../utils/booking'

import '../styles/global.scss'
import '../components/Cart/cart.scss'

const Cart = () => {
  const [event, setEvent] = useState('Not Paid')
  const context = useContext(BookingContext)
  const services = useMemo(
    () => resolveServiceSelections(context?.services || [], Services),
    [context?.services]
  )
  const totals = useMemo(() => getSelectionTotals(services), [services])

  const markPaid = async () => {
    setEvent('Paid')
    context?.setCheckoutStatus('paid')

    try {
      await fetch('/api/integrations/skintwin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_appointment',
          appointment: {
            id: context?.appointment?.id || context?.checkout?.invoiceId || `APT_${Date.now()}`,
            ...context?.appointment,
            client: context?.client,
            services,
            status: 'paid',
            totalAmount: totals.price,
          },
        }),
      })
    } catch (error) {
      console.error('Platform sync after payment failed', error)
    }

    navigate('/confirmation')
  }

  const applyPaymentEvent = (payload) => {
    const name = payload?.event || payload?.detail?.event
    if (name === 'paymentrequest.pending') {
      setEvent('Pending')
      context?.setCheckoutStatus('pending')
    }
    if (name === 'paymentrequest.success') {
      markPaid()
    }
    if (name === 'paymentrequest.failed') {
      setEvent('Failed')
      context?.setCheckoutStatus('failed')
      context?.setCheckoutError('Payment was declined')
    }
  }

  useEffect(() => {
    const pusherKey = process.env.GATSBY_PUSHER_KEY
    const pusher = pusherKey ? new Pusher(pusherKey, { cluster: 'eu' }) : null
    const channel = pusher?.subscribe('my-channel')
    channel?.bind('my-event', applyPaymentEvent)

    const onCustomPayment = (customEvent) => applyPaymentEvent(customEvent.detail || customEvent)
    window.addEventListener('pusher:payment', onCustomPayment)
    window.addEventListener('pusher:payment-event', onCustomPayment)

    return () => {
      channel?.unbind('my-event', applyPaymentEvent)
      pusher?.unsubscribe('my-channel')
      window.removeEventListener('pusher:payment', onCustomPayment)
      window.removeEventListener('pusher:payment-event', onCustomPayment)
    }
    // Payment handlers close over the latest booking snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context])

  if (!services.length) {
    return (
      <Layout pageTitle="Checkout">
        <div className="booking-empty">
          <h1>No Services Selected</h1>
          <p>Select salon services before checkout.</p>
          <button type="button" onClick={() => navigate('/')}>
            Browse Services
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout pageTitle="Checkout">
      <div className="cart" data-testid="booking-summary">
        <h1 className="cart__header">
          <span>Your booking</span>
          <span className="pill" data-testid="payment-status" aria-live="polite">
            {event}
          </span>
        </h1>
        {event === 'Pending' && (
          <div data-testid="payment-status-pending" className="visually-hidden">
            Pending
          </div>
        )}
        {event === 'Failed' && (
          <div data-testid="payment-status-failed" className="visually-hidden">
            Failed
          </div>
        )}
        {event === 'Paid' && (
          <div data-testid="payment-status-success" className="visually-hidden">
            Paid
          </div>
        )}
        <div className="cart__items">
          <Basket
            services={services}
            status={event}
            client={context?.client}
            appointment={context?.appointment}
          />
        </div>
      </div>
    </Layout>
  )
}

export default Cart
