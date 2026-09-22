import React, { useState, createContext, useCallback, useMemo } from 'react'

/**
 * Service selection in the booking
 */
export interface ServiceSelection {
  serviceId: string
  quantity: number
  addOns: string[]
}

/**
 * Appointment details
 */
export interface Appointment {
  id?: string
  date: string
  startTime: string
  endTime: string
  providerId: string
  roomId?: string
  totalDurationMinutes: number
}

/**
 * Client information
 */
export interface Client {
  id?: string
  firstName: string
  lastName: string
  email: string
  phone: string
  consentAccepted: boolean
  intakeCompleted: boolean
}

/**
 * Checkout/payment state
 */
export interface CheckoutState {
  invoiceId: string
  offlineReference: string
  status: 'idle' | 'creating' | 'pending' | 'paid' | 'failed'
  error?: string
}

/**
 * Complete booking state
 */
export interface BookingState {
  services: ServiceSelection[]
  appointment: Appointment | null
  client: Client | null
  checkout: CheckoutState
}

/**
 * Booking context value with state and actions
 */
export interface BookingContextValue extends BookingState {
  // Service actions
  addService: (serviceId: string, addOns?: string[]) => void
  removeService: (serviceId: string) => void
  updateServiceQuantity: (serviceId: string, quantity: number) => void
  clearServices: () => void

  // Appointment actions
  setAppointment: (appointment: Appointment) => void
  clearAppointment: () => void

  // Client actions
  setClient: (client: Client) => void
  updateClientConsent: (accepted: boolean) => void
  updateIntakeStatus: (completed: boolean) => void
  clearClient: () => void

  // Checkout actions
  setCheckoutStatus: (status: CheckoutState['status']) => void
  setInvoiceDetails: (invoiceId: string, offlineReference: string) => void
  setCheckoutError: (error: string) => void
  clearCheckout: () => void

  // Utility
  resetBooking: () => void
  getTotalPrice: (
    servicesList: Array<{
      id: string
      price: number
      durationMinutes?: number
      bufferMinutes?: number
    }>
  ) => number
  getTotalDuration: (
    servicesList: Array<{
      id: string
      price: number
      durationMinutes?: number
      bufferMinutes?: number
    }>
  ) => number

  // Legacy compatibility (for existing cart.js)
  productIds: string[]
  updateCart: (id: number) => void
  resetCart: () => void
}

const initialCheckout: CheckoutState = {
  invoiceId: '',
  offlineReference: '',
  status: 'idle',
}

const STORAGE_KEY = 'skintwin-salon-booking'

const initialState: BookingState = {
  services: [],
  appointment: null,
  client: null,
  checkout: initialCheckout,
}

const readStoredBooking = (): BookingState => {
  if (typeof window === 'undefined') return initialState
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState
    const parsed = JSON.parse(raw)
    return {
      services: parsed.services || [],
      appointment: parsed.appointment || null,
      client: parsed.client || null,
      checkout: { ...initialCheckout, ...(parsed.checkout || {}) },
    }
  } catch {
    return initialState
  }
}

export const BookingContext = createContext<BookingContextValue | undefined>(undefined)

// Also export as CartContext for backwards compatibility
export const CartContext = BookingContext

const BookingContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const stored = readStoredBooking()
  const [services, setServices] = useState<ServiceSelection[]>(stored.services)
  const [appointment, setAppointmentState] = useState<Appointment | null>(stored.appointment)
  const [client, setClientState] = useState<Client | null>(stored.client)
  const [checkout, setCheckout] = useState<CheckoutState>(stored.checkout)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ services, appointment, client, checkout })
    )
  }, [services, appointment, client, checkout])

  // Legacy productIds for backward compatibility with existing cart page
  const productIds = useMemo(() => services.map((s) => s.serviceId), [services])

  // Service actions
  const addService = useCallback((serviceId: string, addOns: string[] = []) => {
    setServices((prev) => {
      const existing = prev.find((s) => s.serviceId === serviceId)
      if (existing) {
        return prev.map((s) =>
          s.serviceId === serviceId
            ? { ...s, quantity: s.quantity + 1, addOns: [...new Set([...s.addOns, ...addOns])] }
            : s
        )
      }
      return [...prev, { serviceId, quantity: 1, addOns }]
    })
  }, [])

  const removeService = useCallback((serviceId: string) => {
    setServices((prev) => prev.filter((s) => s.serviceId !== serviceId))
  }, [])

  const updateServiceQuantity = useCallback(
    (serviceId: string, quantity: number) => {
      if (quantity <= 0) {
        removeService(serviceId)
        return
      }
      setServices((prev) => prev.map((s) => (s.serviceId === serviceId ? { ...s, quantity } : s)))
    },
    [removeService]
  )

  const clearServices = useCallback(() => {
    setServices([])
  }, [])

  // Appointment actions
  const setAppointment = useCallback((apt: Appointment) => {
    setAppointmentState(apt)
  }, [])

  const clearAppointment = useCallback(() => {
    setAppointmentState(null)
  }, [])

  // Client actions
  const setClient = useCallback((c: Client) => {
    setClientState(c)
  }, [])

  const updateClientConsent = useCallback((accepted: boolean) => {
    setClientState((prev) => (prev ? { ...prev, consentAccepted: accepted } : null))
  }, [])

  const updateIntakeStatus = useCallback((completed: boolean) => {
    setClientState((prev) => (prev ? { ...prev, intakeCompleted: completed } : null))
  }, [])

  const clearClient = useCallback(() => {
    setClientState(null)
  }, [])

  // Checkout actions
  const setCheckoutStatus = useCallback((status: CheckoutState['status']) => {
    setCheckout((prev) => ({ ...prev, status, error: undefined }))
  }, [])

  const setInvoiceDetails = useCallback((invoiceId: string, offlineReference: string) => {
    setCheckout((prev) => ({ ...prev, invoiceId, offlineReference }))
  }, [])

  const setCheckoutError = useCallback((error: string) => {
    setCheckout((prev) => ({ ...prev, status: 'failed', error }))
  }, [])

  const clearCheckout = useCallback(() => {
    setCheckout(initialCheckout)
  }, [])

  // Reset everything
  const resetBooking = useCallback(() => {
    setServices([])
    setAppointmentState(null)
    setClientState(null)
    setCheckout(initialCheckout)
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  // Utility functions
  const getTotalPrice = useCallback(
    (
      servicesList: Array<{
        id: string
        price: number
        durationMinutes?: number
        bufferMinutes?: number
      }>
    ) => {
      return services.reduce((total, selection) => {
        const service = servicesList.find((s) => s.id === selection.serviceId)
        if (!service) return total

        let price = service.price * selection.quantity

        // Add add-on prices
        selection.addOns.forEach((addOnId) => {
          const addOn = servicesList.find((s) => s.id === addOnId)
          if (addOn) {
            price += addOn.price
          }
        })

        return total + price
      }, 0)
    },
    [services]
  )

  const getTotalDuration = useCallback(
    (
      servicesList: Array<{
        id: string
        price: number
        durationMinutes?: number
        bufferMinutes?: number
      }>
    ) => {
      return services.reduce((total, selection) => {
        const service = servicesList.find((s) => s.id === selection.serviceId)
        if (!service) return total

        let duration =
          ((service.durationMinutes || 0) + (service.bufferMinutes || 0)) * selection.quantity

        // Add add-on durations
        selection.addOns.forEach((addOnId) => {
          const addOn = servicesList.find((s) => s.id === addOnId)
          if (addOn) {
            duration += addOn.durationMinutes || 0
          }
        })

        return total + duration
      }, 0)
    },
    [services]
  )

  // Legacy compatibility for existing cart.js page
  const updateCart = useCallback(
    (id: number) => {
      addService(id.toString())
    },
    [addService]
  )

  const resetCart = useCallback(() => {
    clearServices()
    clearCheckout()
  }, [clearServices, clearCheckout])

  const value: BookingContextValue = {
    // State
    services,
    appointment,
    client,
    checkout,

    // Service actions
    addService,
    removeService,
    updateServiceQuantity,
    clearServices,

    // Appointment actions
    setAppointment,
    clearAppointment,

    // Client actions
    setClient,
    updateClientConsent,
    updateIntakeStatus,
    clearClient,

    // Checkout actions
    setCheckoutStatus,
    setInvoiceDetails,
    setCheckoutError,
    clearCheckout,

    // Utility
    resetBooking,
    getTotalPrice,
    getTotalDuration,

    // Legacy compatibility
    productIds,
    updateCart,
    resetCart,
  }

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>
}

// Hook for using booking context
export const useBooking = (): BookingContextValue => {
  const context = React.useContext(BookingContext)
  if (!context) {
    throw new Error('useBooking must be used within a BookingContextProvider')
  }
  return context
}

const RootBookingProvider = ({ element }: { element: React.ReactNode }) => (
  <BookingContextProvider>{element}</BookingContextProvider>
)

RootBookingProvider.displayName = 'RootBookingProvider'

// Default export for Gatsby wrapRootElement
export default RootBookingProvider
