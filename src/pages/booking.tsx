import React, { useState, useContext, useMemo, useEffect } from 'react'
import { navigate } from 'gatsby'

import { BookingContext } from '../context/booking-context'
import { Layout } from '../components'
import Services from '../data/services.json'
import Providers from '../data/providers.json'
import {
  formatCurrency,
  formatDuration,
  resolveServiceSelections,
  getSelectionTotals,
} from '../utils/booking'

import '../styles/global.scss'
import '../components/Booking/booking.scss'

interface TimeSlot {
  time: string
  available: boolean
}

const BookingPage: React.FC = () => {
  const context = useContext(BookingContext)
  const [selectedDate, setSelectedDate] = useState<string>(context?.appointment?.date || '')
  const [selectedTime, setSelectedTime] = useState<string>(context?.appointment?.startTime || '')
  const [selectedProvider, setSelectedProvider] = useState<string>(
    context?.appointment?.providerId || ''
  )
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [availabilityError, setAvailabilityError] = useState('')
  const [loadingSlots, setLoadingSlots] = useState(false)

  const bookedServices = useMemo(
    () => resolveServiceSelections(context?.services || [], Services),
    [context?.services]
  )

  const totals = useMemo(() => getSelectionTotals(bookedServices), [bookedServices])

  const availableProviders = useMemo(() => {
    const requiredTypes = new Set<string>()
    bookedServices.forEach((item) => {
      item.serviceId &&
        Services.find((service) => service.id === item.serviceId)?.providerTypes?.forEach(
          (type: string) => requiredTypes.add(type)
        )
    })

    return Providers.filter(
      (provider) => requiredTypes.size === 0 || requiredTypes.has(provider.type)
    )
  }, [bookedServices])

  useEffect(() => {
    if (!selectedProvider && availableProviders.length > 0) {
      setSelectedProvider(availableProviders[0].id)
    }
  }, [availableProviders, selectedProvider])

  const availableDates = useMemo(() => {
    const dates: string[] = []
    const today = new Date()
    for (let i = 1; i <= 30; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      if (date.getDay() !== 0) {
        dates.push(date.toISOString().split('T')[0])
      }
    }
    return dates
  }, [])

  useEffect(() => {
    if (!selectedDate || !selectedProvider) {
      setTimeSlots([])
      return
    }

    let cancelled = false
    setLoadingSlots(true)
    setAvailabilityError('')

    const params = new URLSearchParams({
      date: selectedDate,
      providerId: selectedProvider,
      durationMinutes: String(totals.duration || 60),
    })

    fetch(`/api/appointments/availability?${params.toString()}`)
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load availability')
        return response.json()
      })
      .then((json) => {
        if (cancelled) return
        const providerAvail = json?.data?.availability?.[selectedProvider]
        setTimeSlots(
          (providerAvail?.slots || []).map((slot: TimeSlot) => ({
            time: slot.time,
            available: slot.available,
          }))
        )
      })
      .catch((error) => {
        if (!cancelled) {
          setAvailabilityError(error.message || 'Unable to load availability')
          setTimeSlots([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedDate, selectedProvider, totals.duration])

  const formatDate = (dateStr: string) => {
    const date = new Date(`${dateStr}T00:00:00`)
    return date.toLocaleDateString('en-NG', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  const handleContinue = () => {
    if (!selectedDate || !selectedTime || !selectedProvider) {
      return
    }

    const [hours, mins] = selectedTime.split(':').map(Number)
    const endMinutes = hours * 60 + mins + totals.duration
    const endHours = Math.floor(endMinutes / 60)
    const endMins = endMinutes % 60
    const endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`

    context?.setAppointment({
      date: selectedDate,
      startTime: selectedTime,
      endTime,
      providerId: selectedProvider,
      totalDurationMinutes: totals.duration,
    })

    navigate('/intake')
  }

  if (!context?.services || context.services.length === 0) {
    return (
      <Layout pageTitle="Booking">
        <div className="booking-empty">
          <h1>No Services Selected</h1>
          <p>Please select services before booking.</p>
          <button type="button" onClick={() => navigate('/')}>
            Browse Services
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout pageTitle="Schedule Appointment">
      <div className="booking">
        <h1 className="booking__title">Schedule Your Appointment</h1>

        <section className="booking__summary" data-testid="booking-summary">
          <h2>Selected Services</h2>
          <ul>
            {bookedServices.map((item) => (
              <li key={item.serviceId} data-service={item.serviceId}>
                <span>{item.name}</span>
                <span>{formatDuration(item.durationMinutes)}</span>
              </li>
            ))}
          </ul>
          <div className="booking__totals">
            <span data-testid="total-duration">Total: {formatDuration(totals.duration)}</span>
            <span>{formatCurrency(totals.price)}</span>
          </div>
        </section>

        <section className="booking__section">
          <h2>Select Date</h2>
          <div className="booking__calendar" data-testid="booking-calendar" id="date-picker">
            <div data-testid="date-picker" className="booking__calendar-grid">
              {availableDates.map((date) => (
                <button
                  key={date}
                  type="button"
                  data-date={date}
                  data-testid={`date-${date}`}
                  className={`date-btn ${
                    selectedDate === date ? 'date-btn--selected date-picker__day--selected' : ''
                  }`}
                  onClick={() => {
                    setSelectedDate(date)
                    setSelectedTime('')
                  }}
                >
                  {formatDate(date)}
                </button>
              ))}
            </div>
          </div>
          {selectedDate && (
            <div data-testid="selected-date" className="booking__selected">
              Selected: {formatDate(selectedDate)} ({selectedDate})
            </div>
          )}
        </section>

        <section className="booking__section">
          <h2>Select Provider</h2>
          <div className="booking__providers" data-testid="provider-selector">
            {availableProviders.map((provider) => (
              <button
                key={provider.id}
                type="button"
                data-provider={provider.id}
                className={`provider-btn ${
                  selectedProvider === provider.id ? 'provider-btn--selected' : ''
                }`}
                onClick={() => {
                  setSelectedProvider(provider.id)
                  setSelectedTime('')
                }}
              >
                <strong>{provider.name}</strong>
                <span>{provider.title}</span>
              </button>
            ))}
          </div>
          {selectedProvider && (
            <div data-testid="selected-provider" className="booking__selected">
              Selected: {Providers.find((provider) => provider.id === selectedProvider)?.name}
            </div>
          )}
        </section>

        <section className="booking__section">
          <h2>Select Time</h2>
          {loadingSlots && <p data-testid="availability-loading">Checking availability…</p>}
          {availabilityError && (
            <p className="booking__error" data-testid="error-message" role="alert">
              {availabilityError}
              <button
                type="button"
                data-testid="retry-button"
                onClick={() => setSelectedDate((value) => value)}
              >
                Try again
              </button>
            </p>
          )}
          <div className="booking__timeslots" data-testid="time-slots">
            {timeSlots.map((slot) => (
              <button
                key={slot.time}
                type="button"
                data-time={slot.time}
                data-available={slot.available}
                data-testid={`time-slot-${slot.time}`}
                className={`time-btn ${selectedTime === slot.time ? 'time-btn--selected selected' : ''} ${
                  !slot.available ? 'time-btn--unavailable' : ''
                }`}
                onClick={() => slot.available && setSelectedTime(slot.time)}
                disabled={!slot.available}
              >
                {slot.time}
              </button>
            ))}
          </div>
          {selectedTime && (
            <div data-testid="selected-time" className="booking__selected">
              Selected: {selectedTime}
              <span data-testid="appointment-end-time">
                {' '}
                –{' '}
                {(() => {
                  const [hours, mins] = selectedTime.split(':').map(Number)
                  const end = hours * 60 + mins + totals.duration
                  return `${Math.floor(end / 60)
                    .toString()
                    .padStart(2, '0')}:${(end % 60).toString().padStart(2, '0')}`
                })()}
              </span>
            </div>
          )}
        </section>

        <div className="booking__actions">
          <button
            type="button"
            className="booking__back"
            onClick={() => navigate('/')}
            data-testid="back-to-services"
          >
            Back to Services
          </button>
          <button
            type="button"
            className="booking__continue"
            onClick={handleContinue}
            disabled={!selectedDate || !selectedTime || !selectedProvider}
            data-testid="continue-to-intake"
          >
            Continue to Client Info
          </button>
        </div>
      </div>
    </Layout>
  )
}

export default BookingPage
