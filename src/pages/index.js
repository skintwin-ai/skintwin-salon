import * as React from 'react'
import { navigate } from 'gatsby'
import { Layout, ServiceCard } from '../components'
import { BookingContext } from '../context/booking-context'
import { getServiceCount } from '../utils/booking'

import '../styles/global.scss'
import '../components/ServiceCard/service-card.scss'

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'facials', label: 'Facials' },
  { id: 'treatments', label: 'Treatments' },
  { id: 'consultations', label: 'Consultations' },
  { id: 'packages', label: 'Packages' },
  { id: 'add-ons', label: 'Add-Ons' },
]

const IndexPage = () => {
  const context = React.useContext(BookingContext)
  const [category, setCategory] = React.useState(null)
  const selectedCount = getServiceCount(context?.services)

  return (
    <Layout pageTitle="Salon Services">
      <h1>Salon Services</h1>
      <p>Choose treatments, then schedule your appointment.</p>

      <div className="category-filters" data-testid="category-filter">
        {CATEGORIES.map((item) => {
          const isActive = item.id === 'all' ? !category : category === item.id
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`category-${item.id}`}
              data-category={item.id}
              className={`category-filters__button ${isActive ? 'category-filters__button--active active' : ''}`}
              onClick={() => setCategory(item.id === 'all' ? null : item.id)}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <ServiceCard category={category || undefined} showDescription />

      {selectedCount > 0 && (
        <div className="home-booking-bar">
          <p>
            {selectedCount} service{selectedCount === 1 ? '' : 's'} selected
          </p>
          <button
            type="button"
            className="home-booking-bar__continue"
            data-testid="proceed-to-booking"
            onClick={() => navigate('/booking')}
          >
            Continue to Booking
          </button>
        </div>
      )}
    </Layout>
  )
}

export default IndexPage
