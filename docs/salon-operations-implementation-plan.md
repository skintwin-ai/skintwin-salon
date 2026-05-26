# Salon operations adaptation implementation plan

This repository is currently a Gatsby-based sample restaurant checkout experience. The goal of the next implementation phase is to adapt it into a SkinTwin salon operations experience with a production-ready build pipeline, GitHub Actions CI, and an exhaustive E2E test suite.

## 1. Current-state assessment

### Existing product behavior

- `src/pages/index.js` renders a single product listing view through `ProductCard`.
- `src/pages/cart.js` drives checkout state and payment completion updates with Pusher.
- `src/context/cart-context.js` stores selected item ids only.
- `src/data/products.json` contains a static restaurant menu dataset.
- `src/api/create_invoice.js` and `src/api/push_to_terminal.js` are the main payment integration points.

### Current delivery gaps

- Restaurant terminology, data fields, and UI flows do not match salon operations.
- There is no build CI, lint job, test job, or preview/deploy workflow in `.github/workflows`.
- There is no automated unit, integration, accessibility, or E2E test coverage.
- The current Gatsby 4 dependency tree fails to build on Node 24 because `lmdb-store` cannot compile, so CI should use a supported Node LTS baseline first.

## 2. Target outcome

Ship a salon-focused booking and checkout experience that supports service selection, staff-aware scheduling, intake data capture, and payment completion while keeping the current Gatsby architecture small and maintainable.

## 3. Functional adaptation plan

### Phase 1: Reframe the domain model

Replace the restaurant catalog with salon-oriented entities:

- **Services**: facials, skin consultations, treatment packages, add-ons
- **Providers**: estheticians, specialists, room/resource assignments
- **Appointments**: date, time, duration, status, notes
- **Clients**: profile, contact info, consent/intake completion

Recommended file-level changes:

- Replace `src/data/products.json` with a service catalog containing:
  - `id`
  - `name`
  - `category`
  - `durationMinutes`
  - `price`
  - `providerTypes`
  - `bufferMinutes`
  - `requiresConsultation`
- Rename `ProductCard` semantics toward service cards while keeping the existing component boundary if incremental delivery is preferred.

### Phase 2: Upgrade state management

Extend `src/context/cart-context.js` from a simple item-id list into a booking/session store:

- selected services
- appointment date/time
- assigned provider
- client profile/intake state
- payment state

Recommended state shape:

```js
{
  serviceSelections: [],
  appointment: {
    date: "",
    startTime: "",
    durationMinutes: 0,
    providerId: "",
    roomId: ""
  },
  client: {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    consentAccepted: false
  },
  checkout: {
    invoiceId: "",
    offlineReference: "",
    paymentStatus: "idle"
  }
}
```

### Phase 3: Replace menu flow with salon workflows

Refactor the UI into these steps:

1. **Service discovery**
   - list services by category
   - highlight duration, pricing, prep notes, add-ons
2. **Appointment scheduling**
   - pick date/time
   - select provider/resource
   - block unavailable slots
3. **Client intake**
   - capture client details
   - collect treatment prerequisites and consent
4. **Checkout**
   - confirm appointment summary
   - create invoice
   - push payment to terminal
   - handle paid/pending/failure states
5. **Confirmation**
   - show booking reference, appointment details, aftercare guidance

Suggested route evolution:

- `/` → service discovery
- `/booking` → schedule and intake
- `/cart` or `/checkout` → payment confirmation
- `/confirmation` → appointment receipt

### Phase 4: Harden the API layer

Keep Gatsby Functions as the thin backend boundary and expand them for salon operations:

- appointment creation/update/cancel endpoint
- client intake submission endpoint
- availability lookup endpoint
- invoice creation endpoint
- terminal push endpoint
- webhook verification and booking-status sync endpoint

Operational requirements:

- validate required request fields before forwarding to downstream APIs
- return structured JSON errors
- avoid exposing privileged secrets to the browser
- persist idempotency keys for booking/payment retries

### Phase 5: Optimize for salon operations

Prioritize the following optimizations because they directly affect front-desk efficiency:

- fast repeat-booking path for returning clients
- bundled service pricing and duration calculations
- provider availability conflict checks
- intake completion indicators before payment
- appointment state machine (`draft` → `scheduled` → `payment_pending` → `paid` → `completed`)
- clear handling for no-shows, reschedules, and walk-ins

## 4. Build and CI implementation plan

### CI goals

- verify every pull request
- keep production builds reproducible
- surface accessibility and workflow regressions early
- separate quick feedback from exhaustive scheduled coverage

### Recommended GitHub Actions workflows

#### `ci.yml` (pull requests and pushes)

Purpose: fast feedback on every change.

Jobs:

1. **setup**
   - checkout
   - cache Yarn
   - use Node 18 LTS first, then evaluate Node 20
2. **install**
   - `yarn install --frozen-lockfile`
3. **lint**
   - run ESLint once configured
   - run style checks if adopted
4. **unit-and-integration**
   - execute Jest/Vitest component and function tests
5. **build**
   - `yarn build`
   - upload Gatsby build artifacts when useful for debugging

#### `e2e.yml` (pull requests, merge queue, nightly)

Purpose: browser validation for core salon journeys.

Jobs:

1. install dependencies
2. build the site
3. start the preview server
4. run Playwright across Chromium, Firefox, and WebKit
5. upload traces, videos, and screenshots on failure

#### `release.yml` (main branch only)

Purpose: protect production deployments.

Jobs:

1. rerun build and tests on the protected branch
2. optionally publish static build artifacts
3. trigger deployment target after all checks pass

### CI implementation details

- pin CI to a supported Gatsby/Node combination before enabling a matrix
- use concurrency cancellation for superseded PR runs
- split quick PR checks from exhaustive nightly checks
- upload Playwright reports and Gatsby logs as artifacts
- require branch protection on build, unit, and E2E workflows

## 5. Exhaustive E2E test suite plan

Adopt Playwright for browser coverage and GitHub Actions integration.

### Recommended test structure

```text
e2e/
  fixtures/
  mocks/
  helpers/
  service-selection.spec.js
  scheduling.spec.js
  intake.spec.js
  checkout.spec.js
  terminal-status.spec.js
  accessibility.spec.js
```

### Core scenarios

#### Booking flow coverage

- browse services by category
- add single service to booking
- add multi-service package
- verify total price and total duration
- choose provider and time slot
- reject unavailable time slots
- capture new-client intake details
- resume returning-client flow with prefilled data

#### Checkout coverage

- create invoice successfully
- handle pending terminal payment
- handle successful payment completion
- handle payment failure or timeout
- prevent duplicate submissions
- verify confirmation details after refresh/navigation

#### Operations coverage

- reschedule before payment
- cancel draft appointment
- walk-in checkout path
- provider conflict warning
- service requiring consultation before checkout

#### Accessibility coverage

- keyboard-only booking and checkout
- visible focus order through multi-step flow
- semantic headings, labels, and error messages
- screen-reader announcements for payment status changes

### Test environments and data

- use deterministic fixtures for services, providers, and availability
- mock terminal and webhook interactions in PR runs
- reserve a nightly environment for higher-fidelity API integration tests
- seed stable appointment windows so flakiness stays low

## 6. Delivery phases

### Milestone 1: Platform baseline

- stabilize Node/Gatsby build target
- add lint/test/build scripts
- scaffold GitHub Actions CI
- introduce Playwright and a smoke test

### Milestone 2: Salon domain conversion

- migrate restaurant content to salon services
- add booking state model
- implement scheduling and intake UI
- update payment summary and confirmation screens

### Milestone 3: Operational hardening

- add provider/resource conflicts
- add webhook reconciliation
- add admin-facing appointment state visibility if needed
- expand E2E coverage to failure and accessibility scenarios

## 7. Definition of done

The salon adaptation should be considered implementation-ready when:

- restaurant-specific copy and data are removed from the user flow
- booking, intake, and checkout states are modeled explicitly
- GitHub Actions validates install, build, tests, and E2E runs
- the E2E suite covers happy path, failure path, and accessibility-critical flows
- the production path can confirm an appointment from selection through payment receipt

## 8. Recommended next execution order

1. Lock the supported Node version for Gatsby 4 builds.
2. Add lint/test/build workflow scaffolding in GitHub Actions.
3. Introduce Playwright with one smoke test and artifact upload.
4. Convert static menu data into salon service data.
5. Expand state management for booking, scheduling, intake, and payment.
6. Refactor UI screens incrementally while keeping payment integration working.
7. Grow the E2E suite to full salon operations coverage before launch.
