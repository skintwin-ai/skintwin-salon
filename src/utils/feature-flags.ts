/**
 * Feature Flags Configuration
 * 
 * This module provides feature flag management for gradual rollout
 * of new features in the SkinTwin Salon app.
 */

export interface FeatureFlags {
  /** Enable new booking flow UI */
  newBookingFlow: boolean
  /** Enable provider selection */
  providerSelection: boolean
  /** Enable intake form */
  intakeForm: boolean
  /** Enable real-time availability checking */
  realTimeAvailability: boolean
  /** Enable skintwin-ai recommendations */
  skintwinRecommendations: boolean
  /** Enable multiple services per appointment */
  multiServiceBooking: boolean
  /** Enable rescheduling */
  rescheduling: boolean
  /** Enable cancellation */
  cancellation: boolean
  /** Enable Pusher real-time updates */
  pusherRealtime: boolean
  /** Enable visual regression testing */
  visualRegression: boolean
}

// Default feature flags
const defaultFlags: FeatureFlags = {
  newBookingFlow: true,
  providerSelection: true,
  intakeForm: true,
  realTimeAvailability: false,
  skintwinRecommendations: false,
  multiServiceBooking: true,
  rescheduling: false,
  cancellation: false,
  pusherRealtime: true,
  visualRegression: false,
}

// Environment-based overrides
const environmentOverrides: Partial<Record<string, Partial<FeatureFlags>>> = {
  development: {
    realTimeAvailability: true,
    skintwinRecommendations: true,
    rescheduling: true,
    cancellation: true,
    visualRegression: true,
  },
  staging: {
    realTimeAvailability: true,
    rescheduling: true,
    cancellation: true,
  },
  production: {
    // Production uses defaults - most conservative
  },
}

/**
 * Feature flag storage using localStorage
 */
class FeatureFlagManager {
  private flags: FeatureFlags
  private storageKey = 'skintwin_feature_flags'

  constructor() {
    this.flags = this.loadFlags()
  }

  /**
   * Load flags from environment and localStorage overrides
   */
  private loadFlags(): FeatureFlags {
    const env = process.env.NODE_ENV || 'production'
    const envOverrides = environmentOverrides[env] || {}

    // Start with defaults
    let flags = { ...defaultFlags, ...envOverrides }

    // Apply localStorage overrides (for development/testing)
    if (typeof window !== 'undefined' && env !== 'production') {
      try {
        const stored = localStorage.getItem(this.storageKey)
        if (stored) {
          const parsed = JSON.parse(stored)
          flags = { ...flags, ...parsed }
        }
      } catch {
        // Ignore localStorage errors
      }
    }

    // Apply URL parameter overrides (for testing)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      Object.keys(flags).forEach((key) => {
        const value = params.get(`ff_${key}`)
        if (value !== null) {
          flags[key as keyof FeatureFlags] = value === 'true' || value === '1'
        }
      })
    }

    return flags
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(flag: keyof FeatureFlags): boolean {
    return this.flags[flag] ?? false
  }

  /**
   * Get all current flags
   */
  getAll(): FeatureFlags {
    return { ...this.flags }
  }

  /**
   * Override a flag (development only)
   */
  setFlag(flag: keyof FeatureFlags, value: boolean): void {
    if (process.env.NODE_ENV === 'production') {
      console.warn('Cannot override feature flags in production')
      return
    }

    this.flags[flag] = value

    if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(localStorage.getItem(this.storageKey) || '{}')
        stored[flag] = value
        localStorage.setItem(this.storageKey, JSON.stringify(stored))
      } catch {
        // Ignore localStorage errors
      }
    }
  }

  /**
   * Reset all flags to defaults
   */
  reset(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.storageKey)
    }
    this.flags = this.loadFlags()
  }
}

// Export singleton instance
export const featureFlags = new FeatureFlagManager()

// Export convenience function
export const isFeatureEnabled = (flag: keyof FeatureFlags): boolean => {
  return featureFlags.isEnabled(flag)
}

// React hook for feature flags
export const useFeatureFlag = (flag: keyof FeatureFlags): boolean => {
  // In a real implementation, this would use useState and useEffect
  // to handle dynamic flag changes
  return featureFlags.isEnabled(flag)
}

export default featureFlags
