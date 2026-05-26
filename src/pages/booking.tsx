import React, { useState, useContext, useMemo } from 'react'
import { navigate } from 'gatsby'

import { BookingContext } from '../context/booking-context'
import { Layout } from '../components'
import Services from '../data/services.json'
import Providers from '../data/providers.json'

import '../styles/global.scss'
import '../components/Booking/booking.scss'

interface TimeSlot {
  time: string
  available: boolean
}

const BookingPage: React.FC = () => {
  const context = useContext(BookingContext)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [selectedProvider, setSelectedProvider] = useState<string>('')

  // Get services in booking
  const bookedServices = useMemo(() => {
    if (!context?.services) return []
    return context.services.map((selection) => {
      const service = Services.find((s) => s.id === selection.serviceId)
      return { ...selection, service }
    }).filter((s) => s.service)
  }, [context?.services])

  // Calculate total duration
  const totalDuration = useMemo(() => {
    return bookedServices.reduce((total, item) => {
      if (!item.service) return total
      return total + (item.service.durationMinutes + (item.service.bufferMinutes || 0)) * item.quantity
    }, 0)
  }, [bookedServices])

  // Calculate total price
  const totalPrice = useMemo(() => {
    return bookedServices.reduce((total, item) => {
      if (!item.service) return total
      return total + item.service.price * item.quantity
    }, 0)
  }, [bookedServices])

  // Get available providers based on selected services
  const availableProviders = useMemo(() => {
    const requiredTypes = new Set<string>()
    bookedServices.forEach((item) => {
      if (item.service?.providerTypes) {
        item.service.providerTypes.forEach((type: string) => requiredTypes.add(type))
      }
    })

    return Providers.filter((provider) =>
      requiredTypes.size === 0 || requiredTypes.has(provider.type)
    )
  }, [bookedServices])

  // Generate time slots for selected date
  const timeSlots = useMemo((): TimeSlot[] => {
    const slots: TimeSlot[] = []
    const startHour = 8
    const endHour = 18

    for (let hour = startHour; hour < endHour; hour++) {
      for (const minute of [0, 30]) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        // Simple availability check - in real app, would check against actual bookings
        const available = selectedDate && selectedProvider ? Math.random() > 0.3 : true
        slots.push({ time, available })
      }
    }
    return slots
  }, [selectedDate, selectedProvider])

  // Generate next 30 days for date selection
  const availableDates = useMemo(() => {
    const dates: string[] = []
    const today = new Date()
    for (let i = 1; i <= 30; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      // Skip Sundays (day 0)
      if (date.getDay() !== 0) {
        dates.push(date.toISOString().split('T')[0])
      }
    }
    return dates
  }, [])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-NG', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const handleContinue = () => {
    if (!selectedDate || !selectedTime || !selectedProvider) {
      alert('Please select a date, time, and provider')
      return
    }

    // Calculate end time
    const [hours, mins] = selectedTime.split(':').map(Number)
    const endMinutes = hours * 60 + mins + totalDuration
    const endHours = Math.floor(endMinutes / 60)
    const endMins = endMinutes % 60
    const endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`

    context?.setAppointment({
      date: selectedDate,
      startTime: selectedTime,
      endTime,
      providerId: selectedProvider,
      totalDurationMinutes: totalDuration,
    })

    navigate('/intake')
  }

  if (!context?.services || context.services.length === 0) {
    return (
      <Layout pageTitle="Booking">
        <div className="booking-empty">
          <h2>No Services Selected</h2>
          <p>Please select services before booking.</p>
          <button onClick={() => navigate('/')}>Browse Services</button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout pageTitle="Schedule Appointment">
      <div className="booking">
        <h1 className="booking__title">Schedule Your Appointment</h1>

        {/* Booking Summary */}
        <section className="booking__summary" data-testid="booking-summary">
          <h2>Selected Services</h2>
          <ul>
            {bookedServices.map((item) => (
              <li key={item.serviceId} data-service={item.serviceId}>
                <span>{item.service?.name}</span>
                <span>{formatDuration(item.service?.durationMinutes || 0)}</span>
              </li>
            ))}
          </ul>
          <div className="booking__totals">
            <span data-testid="total-duration">Total: {formatDuration(totalDuration)}</span>
            <span>{formatCurrency(totalPrice)}</span>
          </div>
        </section>

        {/* Date Selection */}
        <section className="booking__section">
          <h2>Select Date</h2>
          <div className="booking__calendar" data-testid="booking-calendar">
            {availableDates.map((date) => (
              <button
                key={date}
                data-date={date}
                className={`date-btn ${selectedDate === date ? 'date-btn--selected' : ''}`}
                onClick={() => setSelectedDate(date)}
              >
                {formatDate(date)}
              </button>
            ))}
          </div>
          {selectedDate && (
            <div data-testid="selected-date" className="booking__selected">
              Selected: {formatDate(selectedDate)}
            </div>
          )}
        </section>

        {/* Provider Selection */}
        <section className="booking__section">
          <h2>Select Provider</h2>
          <div className="booking__providers" data-testid="provider-selector">
            {availableProviders.map((provider) => (
              <button
                key={provider.id}
                data-provider={provider.id}
                className={`provider-btn ${selectedProvider === provider.id ? 'provider-btn--selected' : ''}`}
                onClick={() => setSelectedProvider(provider.id)}
              >
                <strong>{provider.name}</strong>
                <span>{provider.title}</span>
              </button>
            ))}
          </div>
          {selectedProvider && (
            <div data-testid="selected-provider" className="booking__selected">
              Selected: {Providers.find((p) => p.id === selectedProvider)?.name}
            </div>
          )}
        </section>

        {/* Time Selection */}
        <section className="booking__section">
          <h2>Select Time</h2>
          <div className="booking__timeslots" data-testid="time-slots">
            {timeSlots.map((slot) => (
              <button
                key={slot.time}
                data-time={slot.time}
                data-available={slot.available}
                className={`time-btn ${selectedTime === slot.time ? 'time-btn--selected' : ''} ${!slot.available ? 'time-btn--unavailable' : ''}`}
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
            </div>
          )}
        </section>

        {/* Continue Button */}
        <div className="booking__actions">
          <button
            className="booking__back"
            onClick={() => navigate('/')}
            data-testid="back-to-services"
          >
            Back to Services
          </button>
          <button
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
