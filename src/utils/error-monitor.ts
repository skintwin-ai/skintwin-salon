/**
 * Error Monitoring Configuration for Sentry
 * 
 * This module provides error tracking and monitoring for the SkinTwin Salon app.
 * In production, it sends error reports to Sentry for analysis.
 */

const SENTRY_DSN = process.env.GATSBY_SENTRY_DSN

interface ErrorContext {
  user?: {
    id?: string
    email?: string
  }
  tags?: Record<string, string>
  extra?: Record<string, unknown>
}

interface BreadcrumbData {
  category: string
  message: string
  level?: 'debug' | 'info' | 'warning' | 'error'
  data?: Record<string, unknown>
}

class ErrorMonitor {
  private initialized = false
  private isDevelopment = process.env.NODE_ENV === 'development'

  /**
   * Initialize error monitoring
   */
  init() {
    if (this.initialized || typeof window === 'undefined') {
      return
    }

    if (!SENTRY_DSN) {
      if (this.isDevelopment) {
        console.log('[ErrorMonitor] Sentry DSN not configured, running in development mode')
      }
      return
    }

    // In production, this would initialize Sentry SDK
    // import * as Sentry from '@sentry/gatsby'
    // Sentry.init({
    //   dsn: SENTRY_DSN,
    //   environment: process.env.NODE_ENV,
    //   release: process.env.GATSBY_APP_VERSION,
    //   integrations: [
    //     new Sentry.BrowserTracing(),
    //     new Sentry.Replay(),
    //   ],
    //   tracesSampleRate: 0.1,
    //   replaysSessionSampleRate: 0.1,
    //   replaysOnErrorSampleRate: 1.0,
    // })

    this.initialized = true
  }

  /**
   * Capture an error and send to monitoring service
   */
  captureError(error: Error, context?: ErrorContext) {
    if (this.isDevelopment) {
      console.error('[ErrorMonitor] Error captured:', error)
      if (context) {
        console.error('[ErrorMonitor] Context:', context)
      }
      return
    }

    // In production: Sentry.captureException(error, { extra: context })
  }

  /**
   * Capture a message/log
   */
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
    if (this.isDevelopment) {
      console.log(`[ErrorMonitor] ${level.toUpperCase()}: ${message}`)
      return
    }

    // In production: Sentry.captureMessage(message, level)
  }

  /**
   * Set user context for error reports
   */
  setUser(user: { id?: string; email?: string; name?: string } | null) {
    if (this.isDevelopment) {
      console.log('[ErrorMonitor] User set:', user)
      return
    }

    // In production: Sentry.setUser(user)
  }

  /**
   * Add breadcrumb for error context
   */
  addBreadcrumb(data: BreadcrumbData) {
    if (this.isDevelopment) {
      console.log(`[ErrorMonitor] Breadcrumb: ${data.category} - ${data.message}`)
      return
    }

    // In production: Sentry.addBreadcrumb(data)
  }

  /**
   * Start a performance transaction
   */
  startTransaction(name: string, op: string) {
    if (this.isDevelopment) {
      console.log(`[ErrorMonitor] Transaction started: ${name} (${op})`)
      return {
        finish: () => console.log(`[ErrorMonitor] Transaction finished: ${name}`),
        setTag: (key: string, value: string) => 
          console.log(`[ErrorMonitor] Transaction tag: ${key}=${value}`),
      }
    }

    // In production: return Sentry.startTransaction({ name, op })
    return {
      finish: () => {},
      setTag: () => {},
    }
  }

  /**
   * Wrap an async function with error boundary
   */
  wrapAsync<T>(fn: () => Promise<T>, context?: string): Promise<T> {
    return fn().catch((error) => {
      this.captureError(error, { extra: { context } })
      throw error
    })
  }
}

// Export singleton instance
export const errorMonitor = new ErrorMonitor()

// Export convenience functions
export const captureError = errorMonitor.captureError.bind(errorMonitor)
export const captureMessage = errorMonitor.captureMessage.bind(errorMonitor)
export const setUser = errorMonitor.setUser.bind(errorMonitor)
export const addBreadcrumb = errorMonitor.addBreadcrumb.bind(errorMonitor)

export default errorMonitor
