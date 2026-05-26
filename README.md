# SkinTwin Salon

A Gatsby 4 salon booking and checkout experience with Paystack Terminal integration, aligned with the [skintwin-ai](https://github.com/skintwin-ai) ecosystem.

## 🌟 Features

- **Service Discovery**: Browse salon services by category
- **Booking Management**: Schedule appointments with providers
- **Client Intake**: Capture client information and consent
- **Payment Processing**: Integrated with Paystack Terminal
- **Real-time Updates**: Pusher-powered payment status notifications
- **Error Monitoring**: Production-ready error tracking
- **Feature Flags**: Gradual rollout capabilities

## 📋 Requirements

- **Node.js**: 18.x LTS (required for Gatsby 4 compatibility)
- **Paystack Terminal**: Required for payment flow ([request via support@paystack.com](mailto:support@paystack.com))
- **Pusher Account**: For real-time payment updates ([create channel](https://pusher.com/channels))
- **Gatsby Cloud**: For deployment ([deploy now](https://www.gatsbyjs.com/dashboard/deploynow?url=https://github.com/jax-a11y/skintwin-salon))

## 🚀 Getting Started

### 1. Clone the repository

```shell
git clone git@github.com:jax-a11y/skintwin-salon.git
cd skintwin-salon
```

### 2. Install dependencies

```shell
yarn install
```

### 3. Configure environment

Copy `.env.example` to `.env.development` and fill in your credentials:

```shell
cp .env.example .env.development
```

### 4. Start development server

```shell
yarn develop
```

Your site will be running at http://localhost:8000

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `yarn develop` | Start development server |
| `yarn build` | Build for production |
| `yarn serve` | Serve production build |
| `yarn clean` | Clear Gatsby cache |
| `yarn lint` | Run ESLint |
| `yarn lint:fix` | Fix ESLint issues |
| `yarn format` | Format code with Prettier |
| `yarn format:check` | Check formatting |
| `yarn typecheck` | Run TypeScript checks |
| `yarn test` | Run unit tests |
| `yarn test:watch` | Run tests in watch mode |
| `yarn test:coverage` | Run tests with coverage |
| `yarn e2e` | Run E2E tests |
| `yarn e2e:ui` | Run E2E tests with UI |
| `yarn e2e:headed` | Run E2E tests in headed mode |

## 🧪 Testing

### Unit Tests (Vitest)

```shell
yarn test              # Run once
yarn test:watch        # Watch mode
yarn test:coverage     # With coverage report
```

### E2E Tests (Playwright)

```shell
yarn e2e               # Run all E2E tests
yarn e2e:ui            # Interactive UI mode
yarn e2e:headed        # Run with visible browser
```

### Accessibility Testing

E2E tests include comprehensive accessibility audits using axe-core:
- WCAG 2.1 AA compliance checks
- Heading structure validation
- Color contrast verification
- Form label associations
- Keyboard navigation

## 🔄 CI/CD

This repository uses GitHub Actions for continuous integration:

- **CI** (`ci.yml`): Lint, type-check, unit tests, and build on every PR
- **E2E** (`e2e.yml`): Cross-browser E2E tests on PRs and nightly
- **Release** (`release.yml`): Production deployment pipeline
- **Security** (`security.yml`): Dependency audits and CodeQL analysis
- **Lighthouse** (`lighthouse.yml`): Performance and accessibility audits

### Dependabot

Automated dependency updates are configured via `.github/dependabot.yml`:
- Weekly npm dependency updates
- Grouped minor/patch updates
- GitHub Actions updates

## 🚦 Feature Flags

Feature flags allow gradual rollout of new features. Configure in `src/utils/feature-flags.ts`:

```typescript
import { isFeatureEnabled } from './utils/feature-flags'

if (isFeatureEnabled('newBookingFlow')) {
  // New booking flow
}
```

Override flags via URL parameters: `?ff_newBookingFlow=true`

## 📊 Error Monitoring

Error monitoring is configured in `src/utils/error-monitor.ts`. In production, configure Sentry:

```shell
GATSBY_SENTRY_DSN=https://your-dsn@sentry.io/project
```

## 📁 Project Structure

```
skintwin-salon/
├── .github/
│   ├── workflows/         # CI/CD workflows
│   └── dependabot.yml     # Dependency updates
├── e2e/                   # E2E test suite
│   ├── fixtures/          # Test data
│   ├── mocks/             # API mocks
│   ├── helpers/           # Test utilities
│   ├── pages/             # Page objects
│   └── specs/             # Test specifications
├── src/
│   ├── api/               # Gatsby Functions (serverless)
│   │   ├── appointments/  # Appointment CRUD
│   │   ├── clients/       # Client management
│   │   ├── integrations/  # skintwin-ai connector
│   │   └── payments/      # Paystack integration
│   ├── components/        # React components
│   ├── context/           # React Context providers
│   ├── data/              # Static data (JSON)
│   ├── pages/             # Gatsby pages
│   ├── styles/            # SCSS styles
│   ├── test/              # Unit test setup
│   └── utils/             # Utilities (error monitor, feature flags)
├── static/                # Static assets
├── playwright.config.ts   # Playwright configuration
├── vitest.config.ts       # Vitest configuration
├── lighthouserc.json      # Lighthouse CI configuration
└── tsconfig.json          # TypeScript configuration
```

## 🔗 Related

- [skintwin-ai](https://github.com/skintwin-ai) - Parent ecosystem
- [Paystack Terminal Docs](https://paystack.com/docs/terminal/)
- [Gatsby Documentation](https://www.gatsbyjs.com/docs/)

## 📄 License

Private
