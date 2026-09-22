import React, { useContext } from 'react'
import { Link } from 'gatsby'

import { BookingContext } from '../../context/booking-context'
import { getServiceCount } from '../../utils/booking'
import './nav.scss'

const Nav = () => {
  const context = useContext(BookingContext)
  const count = getServiceCount(context?.services)

  return (
    <nav className="nav" aria-label="Main">
      <Link className="nav__brand" to="/" aria-label="SkinTwin Salon home">
        <svg
          width="24"
          height="24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect width="24" height="24" rx="5" fill="#285056" />
        </svg>
        <svg
          width="24"
          height="24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect width="24" height="24" rx="12" fill="#FFAD00" />
        </svg>
        <svg
          width="28"
          height="22"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M12.626.503c.419-.67 1.462-.67 1.882 0l12.477 19.98c.42.673-.103 1.517-.941 1.517H1.089c-.838 0-1.361-.844-.94-1.518L12.626.503z"
            fill="#E9623B"
          />
        </svg>
        <span className="nav__brand-name">SkinTwin Salon</span>
      </Link>
      <ul className="nav__items">
        <li>
          <Link to="/booking" className="nav__link">
            Schedule
          </Link>
        </li>
        <li>
          <Link
            to="/cart"
            className="nav__cart"
            aria-label={`Checkout, ${count} services selected`}
            data-testid="proceed-to-checkout"
          >
            <span>Checkout</span>
            <span data-testid="booking-count" id="cart-count">
              {count}
            </span>
            <span data-testid="cart-count" className="visually-hidden">
              {count}
            </span>
          </Link>
        </li>
      </ul>
    </nav>
  )
}

export default Nav
