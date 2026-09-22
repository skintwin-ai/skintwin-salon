import React, { useState, useContext } from 'react'
import { navigate } from 'gatsby'

import { BookingContext } from '../context/booking-context'
import { Layout } from '../components'
import Services from '../data/services.json'
import { getSelectionTotals, resolveServiceSelections } from '../utils/booking'

import '../styles/global.scss'
import '../components/Intake/intake.scss'

const IntakePage: React.FC = () => {
  const context = useContext(BookingContext)

  const [formData, setFormData] = useState({
    firstName: context?.client?.firstName || '',
    lastName: context?.client?.lastName || '',
    email: context?.client?.email || '',
    phone: context?.client?.phone || '',
    consentAccepted: context?.client?.consentAccepted || false,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lookupEmail, setLookupEmail] = useState('')
  const [lookupPhone, setLookupPhone] = useState('')
  const [clientFound, setClientFound] = useState(false)
  const [clientId, setClientId] = useState(context?.client?.id || '')
  const [savedMessage, setSavedMessage] = useState('')

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const validatePhone = (phone: string) => /^\+?[\d\s-]{10,}$/.test(phone)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))

    if (errors[name] || (name === 'consentAccepted' && errors.consent)) {
      setErrors((prev) => ({ ...prev, [name]: '', consent: '' }))
    }
  }

  const applyClient = (client: {
    id?: string
    firstName: string
    lastName: string
    email: string
    phone: string
    consentAccepted?: boolean
  }) => {
    setFormData({
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
      consentAccepted: Boolean(client.consentAccepted),
    })
    setClientId(client.id || '')
    setClientFound(true)
  }

  const handleLookup = async () => {
    if (lookupEmail && !validateEmail(lookupEmail)) {
      setErrors({ lookupEmail: 'Please enter a valid email address' })
      return
    }

    if (!lookupEmail && !lookupPhone) {
      setErrors({ lookupEmail: 'Please enter a valid email address' })
      return
    }

    setIsLookingUp(true)
    setErrors({})
    setClientFound(false)

    try {
      const params = new URLSearchParams()
      if (lookupEmail) params.set('email', lookupEmail)
      if (lookupPhone) params.set('phone', lookupPhone)

      const response = await fetch(`/api/clients/lookup?${params.toString()}`)
      const json = await response.json()

      if (!response.ok || !json?.data) {
        setClientFound(false)
        setErrors({ lookupEmail: json?.message || 'No client found with this email' })
        return
      }

      applyClient(json.data)
    } catch {
      setErrors({ lookupEmail: 'Error looking up client' })
    } finally {
      setIsLookingUp(false)
    }
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required'
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required'

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required'
    } else if (!validatePhone(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number'
    }

    if (!formData.consentAccepted) {
      newErrors.consent = 'You must accept the consent to continue'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSaving(true)
    setErrors({})

    try {
      const identity = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        consentAccepted: formData.consentAccepted,
        intakeCompleted: true,
      }

      const saveResponse = clientId
        ? await fetch('/api/clients/intake', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId,
              ...identity,
              skinType: 'unknown',
              allergies: [],
              currentProducts: [],
            }),
          })
        : await fetch('/api/clients/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(identity),
          })

      const saved = await saveResponse.json()
      if (!saveResponse.ok || !saved?.data) {
        setErrors({ form: saved?.message || 'Unable to save client information' })
        return
      }

      const clientRecord = saved.data.client || saved.data
      const nextClient = {
        id: clientRecord.id,
        firstName: clientRecord.firstName,
        lastName: clientRecord.lastName,
        email: clientRecord.email,
        phone: clientRecord.phone,
        consentAccepted: true,
        intakeCompleted: true,
      }

      context?.setClient(nextClient)
      setClientId(nextClient.id || '')
      setSavedMessage('Client information saved')

      if (context?.appointment && context.services.length > 0) {
        const resolved = resolveServiceSelections(context.services, Services)
        const totals = getSelectionTotals(resolved)
        const appointmentResponse = await fetch('/api/appointments/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            services: context.services,
            date: context.appointment.date,
            startTime: context.appointment.startTime,
            endTime: context.appointment.endTime,
            providerId: context.appointment.providerId,
            client: nextClient,
            totalAmount: totals.price,
            currency: 'NGN',
          }),
        })
        const appointmentJson = await appointmentResponse.json()
        if (appointmentResponse.ok && appointmentJson?.data?.id) {
          context.setAppointment({
            ...context.appointment,
            id: appointmentJson.data.id,
          })
          context.setInvoiceDetails(appointmentJson.data.reference || appointmentJson.data.id, '')
        }
      }

      navigate('/cart')
    } catch {
      setErrors({ form: 'Unable to save client information' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Layout pageTitle="Client Information">
      <div className="intake">
        <h1 className="intake__title">Client Information</h1>

        {!context?.appointment && (
          <div className="intake__notice" data-testid="intake-missing-appointment">
            <p>Schedule an appointment so we can attach this intake to a booking.</p>
            <button type="button" onClick={() => navigate('/booking')}>
              Schedule Appointment
            </button>
          </div>
        )}

        <section className="intake__section" data-testid="returning-client-tab">
          <h2>Returning Client?</h2>
          <p>Enter your email or phone to prefill your information</p>
          <div className="intake__lookup">
            <label htmlFor="lookup-email">Lookup email</label>
            <input
              id="lookup-email"
              type="email"
              value={lookupEmail}
              onChange={(e) => setLookupEmail(e.target.value)}
              placeholder="Enter your email"
              data-testid="lookup-email"
            />
            <label htmlFor="lookup-phone">Lookup phone</label>
            <input
              id="lookup-phone"
              type="tel"
              value={lookupPhone}
              onChange={(e) => setLookupPhone(e.target.value)}
              placeholder="Enter your phone"
              data-testid="lookup-phone"
            />
            <button
              type="button"
              onClick={handleLookup}
              disabled={isLookingUp}
              data-testid="lookup-button"
              id="lookup-client"
            >
              {isLookingUp ? 'Looking up...' : 'Look Up'}
            </button>
          </div>
          {errors.lookupEmail && (
            <span className="intake__error" data-testid="error-lookupEmail">
              {errors.lookupEmail}
            </span>
          )}
          {clientFound && (
            <div className="intake__found" data-testid="client-found">
              <span data-testid="client-found-message">
                Welcome back! Your information has been prefilled.
              </span>
              {formData.firstName && <p>{formData.firstName}</p>}
              <p data-testid="previous-visits">Previous visits recorded</p>
            </div>
          )}
        </section>

        <form onSubmit={handleSubmit} className="intake__form" data-testid="client-form">
          {errors.form && (
            <span className="intake__error" data-testid="error-message">
              {errors.form}
            </span>
          )}
          {savedMessage && (
            <div className="intake__found" data-testid="client-saved-message">
              {savedMessage}
            </div>
          )}
          <div className="intake__row">
            <div className="intake__field">
              <label htmlFor="firstName">First Name *</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                data-testid="first-name"
              />
              {errors.firstName && (
                <span
                  className="intake__error"
                  data-error-for="firstName"
                  data-testid="error-firstName"
                >
                  {errors.firstName}
                </span>
              )}
            </div>

            <div className="intake__field">
              <label htmlFor="lastName">Last Name *</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                data-testid="last-name"
              />
              {errors.lastName && (
                <span
                  className="intake__error"
                  data-error-for="lastName"
                  data-testid="error-lastName"
                >
                  {errors.lastName}
                </span>
              )}
            </div>
          </div>

          <div className="intake__row">
            <div className="intake__field">
              <label htmlFor="email">Email Address *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                data-testid="email"
              />
              {errors.email && (
                <span className="intake__error" data-error-for="email" data-testid="error-email">
                  {errors.email}
                </span>
              )}
            </div>

            <div className="intake__field">
              <label htmlFor="phone">Phone Number *</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="+234..."
                data-testid="phone"
              />
              {errors.phone && (
                <span className="intake__error" data-error-for="phone" data-testid="error-phone">
                  {errors.phone}
                </span>
              )}
            </div>
          </div>

          <div className="intake__consent">
            <label className="intake__checkbox" htmlFor="consentAccepted">
              <input
                type="checkbox"
                id="consentAccepted"
                name="consentAccepted"
                checked={formData.consentAccepted}
                onChange={handleInputChange}
                data-testid="consent-checkbox"
              />
              <span>
                I consent to receive treatment and understand the salon policies. I confirm that all
                information provided is accurate. *
              </span>
            </label>
            {errors.consent && (
              <span className="intake__error" data-error-for="consent" data-testid="error-consent">
                {errors.consent}
              </span>
            )}
          </div>

          <div className="intake__actions">
            <button
              type="button"
              className="intake__back"
              onClick={() => navigate('/booking')}
              data-testid="back-to-booking"
            >
              Back to Scheduling
            </button>
            <button
              type="submit"
              className="intake__continue"
              data-testid="continue-to-checkout"
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : 'Continue to Checkout'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  )
}

export default IntakePage
