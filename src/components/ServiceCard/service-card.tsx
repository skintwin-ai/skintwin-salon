import React, { useContext } from 'react'
import { graphql, useStaticQuery } from 'gatsby'
import { GatsbyImage, getImage } from 'gatsby-plugin-image'

import { BookingContext } from '../../context/booking-context'
import Services from '../../data/services.json'
import './service-card.scss'

interface Service {
  id: string
  name: string
  category: string
  description: string
  durationMinutes: number
  bufferMinutes: number
  price: number
  currency: string
  providerTypes: string[]
  requiresConsultation: boolean
  addOns: string[]
  image: string
}

interface ServiceCardProps {
  category?: string
  showDescription?: boolean
}

const ServiceCard: React.FC<ServiceCardProps> = ({ category, showDescription = false }) => {
  const context = useContext(BookingContext)

  const data = useStaticQuery(graphql`
    query {
      allFile(filter: { extension: { regex: "/(jpg)|(png)|(jpeg)/" } }) {
        edges {
          node {
            base
            childImageSharp {
              gatsbyImageData(placeholder: BLURRED, formats: [AUTO, WEBP, AVIF])
            }
          }
        }
      }
    }
  `)

  const filterImage = (path: string) => {
    const image = data.allFile.edges.find(
      (edge: { node: { base: string } }) => edge.node.base === path
    )
    return image ? getImage(image.node) : null
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      facials: 'Facials',
      treatments: 'Treatments',
      consultations: 'Consultations',
      packages: 'Packages',
      'add-ons': 'Add-Ons',
    }
    return labels[cat] || cat
  }

  // Filter services by category if specified
  const filteredServices = category
    ? Services.filter((service: Service) => service.category === category)
    : Services.filter((service: Service) => service.category !== 'add-ons')

  return (
    <div className="service-container">
      {filteredServices.map((service: Service) => {
        const image = filterImage(service.image)

        return (
          <div
            key={service.id}
            className="service"
            data-testid={`service-card-${service.id}`}
            data-category={service.category}
          >
            {image && (
              <GatsbyImage
                image={image}
                alt={service.name}
                className="service__image"
                placeholder="blurred"
              />
            )}

            <div className="service__content">
              <span className="service__category">{getCategoryLabel(service.category)}</span>
              <h2 className="service__title" data-testid="service-name">
                {service.name}
              </h2>

              {showDescription && (
                <p className="service__description">{service.description}</p>
              )}

              <div className="service-meta">
                <span className="service-meta__price" data-testid="service-price">
                  {formatCurrency(service.price)}
                </span>
                <span className="service-meta__duration" data-testid="service-duration">
                  {formatDuration(service.durationMinutes)}
                </span>
              </div>

              {service.requiresConsultation && (
                <span className="service__consultation-badge">
                  Consultation Required
                </span>
              )}

              <div className="service__actions">
                <button
                  className="service__add-btn"
                  data-testid={`add-service-${service.id}`}
                  onClick={() => context?.addService(service.id)}
                  aria-label={`Add ${service.name} to booking`}
                >
                  <svg
                    width="16"
                    height="16"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span>Add to Booking</span>
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default ServiceCard
