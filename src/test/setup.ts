import '@testing-library/jest-dom'
import React from 'react'
import { vi, beforeAll, afterAll } from 'vitest'

vi.mock('gatsby', () => {
  return {
    graphql: vi.fn(),
    Link: vi
      .fn()
      .mockImplementation(({ to, children, ...rest }) =>
        React.createElement('a', { ...rest, href: to }, children)
      ),
    StaticQuery: vi.fn(),
    useStaticQuery: vi.fn(() => ({
      allFile: { edges: [] },
    })),
    navigate: vi.fn(),
  }
})

vi.mock('pusher-js', () => {
  return vi.fn().mockImplementation(() => ({
    subscribe: vi.fn().mockReturnValue({
      bind: vi.fn(),
      unbind: vi.fn(),
    }),
    unsubscribe: vi.fn(),
    disconnect: vi.fn(),
  }))
})

process.env.GATSBY_PUSHER_KEY = 'test-pusher-key'
process.env.GATSBY_BASE_API = 'https://api.paystack.co'
process.env.GATSBY_AUTH_KEY = 'test-auth-key'
process.env.GATSBY_TERMINAL_ID = 'test-terminal-id'

const originalError = console.error
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})
