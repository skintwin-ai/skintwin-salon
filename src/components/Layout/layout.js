import React from 'react'
import { Helmet } from 'react-helmet'
import { Nav } from '../index'
import '../../styles/global.scss'
import { container } from './layout.module.scss'

const Layout = ({ pageTitle, children }) => {
  const title = pageTitle ? `${pageTitle} | SkinTwin Salon` : 'SkinTwin Salon'

  return (
    <main className={container} id="main">
      <Helmet htmlAttributes={{ lang: 'en' }}>
        <title>{title}</title>
      </Helmet>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Nav />
      <div id="main-content">{children}</div>
    </main>
  )
}

export default Layout
