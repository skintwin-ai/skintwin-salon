import '@testing-library/jest-dom'

// Mock Gatsby's navigate function
jest.mock('gatsby', () => {
  const React = require('react')
  const gatsby = jest.requireActual('gatsby')

  return {
    ...gatsby,
    graphql: jest.fn(),
    Link: jest.fn().mockImplementation(
      ({
        activeClassName,
        activeStyle,
        getProps,
        innerRef,
        partiallyActive,
        ref,
        replace,
        to,
        ...rest
      }) =>
        React.createElement('a', {
          ...rest,
          href: to,
        })
    ),
    StaticQuery: jest.fn(),
    useStaticQuery: jest.fn(),
    navigate: jest.fn(),
  }
})

// Mock Pusher
jest.mock('pusher-js', () => {
  return jest.fn().mockImplementation(() => ({
    subscribe: jest.fn().mockReturnValue({
      bind: jest.fn(),
      unbind: jest.fn(),
    }),
    unsubscribe: jest.fn(),
    disconnect: jest.fn(),
  }))
})

// Mock environment variables
process.env.GATSBY_PUSHER_KEY = 'test-pusher-key'
process.env.GATSBY_BASE_API = 'https://api.paystack.co'
process.env.GATSBY_AUTH_KEY = 'test-auth-key'
process.env.GATSBY_TERMINAL_ID = 'test-terminal-id'

// Suppress console errors in tests (optional)
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
