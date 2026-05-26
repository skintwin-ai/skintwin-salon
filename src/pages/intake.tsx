import React, { useState, useContext } from 'react'
import { navigate } from 'gatsby'

import { BookingContext } from '../context/booking-context'
import { Layout } from '../components'

import '../styles/global.scss'
import '../components/Intake/intake.scss'

const IntakePage: React.FC = () => {
  const context = useContext(BookingContext)

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    consentAccepted: false,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [lookupEmail, setLookupEmail] = useState('')
  const [clientFound, setClientFound] = useState(false)

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const validatePhone = (phone: string) => {
    return /^\+?[\d\s-]{10,}$/.test(phone)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const handleLookup = async () => {
    if (!lookupEmail || !validateEmail(lookupEmail)) {
      setErrors({ lookupEmail: 'Please enter a valid email address' })
      return
    }

    setIsLookingUp(true)
    setErrors({})

    try {
      // Simulate API lookup - in real app, would call actual API
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Simulated found client
      if (lookupEmail === 'adaeze.obi@example.com') {
        setFormData({
          firstName: 'Adaeze',
          lastName: 'Obi',
          email: 'adaeze.obi@example.com',
          phone: '+2348012345678',
          consentAccepted: true,
        })
        setClientFound(true)
      } else {
        setClientFound(false)
        setErrors({ lookupEmail: 'No client found with this email' })
      }
    } catch (error) {
      setErrors({ lookupEmail: 'Error looking up client' })
    } finally {
      setIsLookingUp(false)
    }
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required'
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    }

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    context?.setClient({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      consentAccepted: formData.consentAccepted,
      intakeCompleted: true,
    })

    navigate('/cart')
  }

  if (!context?.appointment) {
    return (
      <Layout pageTitle="Client Information">
        <div className="intake-empty">
          <h2>No Appointment Scheduled</h2>
          <p>Please schedule an appointment first.</p>
          <button onClick={() => navigate('/booking')}>Schedule Appointment</button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout pageTitle="Client Information">
      <div className="intake">
        <h1 className="intake__title">Client Information</h1>

        {/* Returning Client Lookup */}
        <section className="intake__section">
          <h2>Returning Client?</h2>
          <p>Enter your email to prefill your information</p>
          <div className="intake__lookup">
            <input
              type="email"
              value={lookupEmail}
              onChange={(e) => setLookupEmail(e.target.value)}
              placeholder="Enter your email"
              data-testid="lookup-email"
            />
            <button
              type="button"
              onClick={handleLookup}
              disabled={isLookingUp}
              data-testid="lookup-client"
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
              ✓ Welcome back! Your information has been prefilled.
            </div>
          )}
        </section>

        {/* Client Form */}
        <form onSubmit={handleSubmit} className="intake__form" data-testid="client-form">
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
                <span className="intake__error" data-error-for="firstName" data-testid="error-firstName">
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
                <span className="intake__error" data-error-for="lastName" data-testid="error-lastName">
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
            <label className="intake__checkbox">
              <input
                type="checkbox"
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
            >
              Continue to Checkout
            </button>
          </div>
        </form>
      </div>
    </Layout>
  )
}

export default IntakePage
