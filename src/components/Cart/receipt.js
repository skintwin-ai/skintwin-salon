import React, { useEffect } from 'react'
import { navigate } from 'gatsby'

const Receipt = () => {
  useEffect(() => {
    navigate('/confirmation')
  }, [])

  return (
    <div className="success-prompt" data-testid="payment-success">
      <h1>Booking confirmed</h1>
      <p>Payment received. Taking you to your salon receipt.</p>
    </div>
  )
}

export default Receipt
