# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev`: run with hot reload (`tsx watch src/server.ts`)
- `npm run build`: `prisma generate && tsc` to `dist/`
- `npm start`: run the compiled `dist/server.js`
- `npm run lint` / `npm run lint:fix`: ESLint
- `npm run format` / `npm run format:check`: Prettier (double quotes, semicolons, `trailingComma: es5`, `arrowParens: avoid`)
- `npm run seed:admin`: create the admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Inside the Docker container use `docker compose exec server npm run seed:admin:prod` (runs the compiled `dist/seedAdmin.js`).
- `npm run migrate:revenuecat` (`:prod` in Docker): one-off Stripe → RevenueCat data migration. Run it once **before** `npx prisma db push`. It is safe to re-run.
- `npm run migrate:data` (`:prod` in Docker): one-off data fixes. Run it **before** deploying the code that uses them; it is safe to re-run.
  - Renames the `CAMPING` symptom to `CRAMPING`.
  - Lower-cases emails. Accounts whose emails differ only by case are reported, not merged.
  - Backfills the GBP amounts on payments.
- `src/server.ts` shuts down gracefully on SIGTERM/SIGINT: it stops the cron jobs, drains HTTP, disconnects Prisma, and force-exits after 8s.
- `npx tsc --noEmit`: type-check only
- `npx prisma db push`: sync `prisma/schema.prisma` to the database. The database is MongoDB, so there are no migrations. `npx prisma generate` runs on `postinstall`.

There is no test suite.

## Stack

Express 5, TypeScript (ESM, `module: NodeNext`), Prisma 6 on MongoDB, Zod 4, JWT auth, RevenueCat in-app subscriptions (REST API called with native `fetch`, no SDK), AWS S3 uploads through multer memory storage, Firebase Admin (FCM push), `node-cron` scheduled jobs, and email sent over HTTP to an external service (`SEND_EMAIL_URL`). `socket.io` is installed but not used anywhere yet.

- **ESM imports must use the `.js` extension**, even from `.ts` files (`import x from "./foo.js"`).
- The tsconfig is strict and also sets `noUncheckedIndexedAccess`, `noUnusedLocals`, and `noUnusedParameters`. Prefix unused parameters with `_`.
- Config is read from env vars in `src/app/config/index.ts`. `PORT` defaults to 5003. If the S3 keys are unset, the S3 client falls back to the AWS default credential chain (e.g. an IAM role). Of the Firebase variables, only `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` are read; config converts the literal `\n` in the private key into real newlines.

## Architecture

Request flow: `src/server.ts` → `src/app/app.ts` → `src/app/routes/index.ts` (mounted at `/api/v1`) → the module's router.

Each feature lives in `src/app/modules/<name>/` and has five files:
- `<name>.routes.ts`: an Express `Router` with middleware chains. Export it as `<name>Routes` and register it in `src/app/routes/index.ts`.
- `<name>.controller.ts`: wraps each handler in `handleAsyncRequest` and replies through `sendResponse(res, { status?, message, data })`. Exports a `<name>Controller` object.
- `<name>.service.ts`: Prisma logic. Exports a `<name>Services` object. User-owned records are scoped by `authId` (`req.user!.id`). Ownership is checked with `findFirst({ where: { id, authId } })`, and a miss throws `ApiError(404, ...)`.
- `<name>.validation.ts`: Zod schemas named `create<X>Zod` / `update<X>Zod`, plus the inferred `T<X>` types.
- `<name>.swagger.ts`: OpenAPI fragment `{ tag, paths }`. Register it in `src/app/docs/swagger.ts`.

### Middleware
- `authorize(...roles)` in `middlewares/authorize.ts` reads a Bearer JWT and sets `req.user = { id, email, role }`. Use `authorize({ optional: true }, ...roles)` for optional auth. Handlers type `req` as `TRequest` from `interface/global.interface.ts`.
  - **It also checks the database on every request:** the account must be `ACTIVE`, and the token's `tv` claim must equal `Auth.tokenVersion`. The role is taken from the DB.
  - Bump `tokenVersion` to revoke every token of a user. Password change, password reset and block already do this.
  - Every token you sign must include `tv`.
- `authLimiter` (20 requests per 15 minutes) and `otpLimiter` (10 per 15 minutes) in `middlewares/rateLimit.ts` are per IP. They guard signup, login, reset and change password, account deletion, and `/otp/*`.
- The refresh token is sent in the `player-centralRefreshToken` cookie (`SameSite=Lax`), or in the `x-refresh-token` header for mobile apps. Login with `isMobileApp: true` also returns it in the body.
- `requirePremium` lets the request through only when the user's `Subscription.status === ACTIVE`. Most user-data modules apply `router.use(authorize(UserRole.USER), requirePremium)`.
- Zod runs only in routes through `validate(...)`, never in controllers.
  - `validate(schema)` validates `req.body` and **replaces** it with the parsed result.
    - Unknown keys are stripped. This is a security boundary: services pass payloads to Prisma, and an unstripped body allows nested writes such as `auth: { update: { role: "ADMIN" } }`.
    - Trims, defaults and coercions (`z.coerce.date()`) reach the service. `{ replace: true }` is now redundant.
    - **Never put `.default()` in a schema that is reused through `.partial()` for PATCH.** Zod 4 still applies the default there, and that wipes the field on every update. Write a separate update schema instead (see `note.validation.ts`).
  - `validate(schema, { formData: true })` parses `req.body.payload` as a JSON string and replaces `req.body`. Validation is skipped when `payload` is missing.
  - `validate(schema, { query: true })` validates `req.query` and puts the parsed values back on `req.query`. Keys outside the schema, such as `page` and `limit`, are kept. The controller reads it as `req.query as T<X>Query`.
- File uploads use `upload` (any type, max 20MB) or `uploadImage` (images only: jpeg/png/webp, max 5MB), together with `uploadToS3` / `deleteFromS3`, all in `utils/awss3.ts`. For cleanup after a successful DB write, use `safeDeleteFromS3`, which never throws.

### Errors and responses
- Throw `new ApiError(status, message)` (`classes/ApiError.ts`). `middlewares/globalErrorHandler.ts` maps ApiError, ZodError, Prisma errors (P2002, P2025, P2003, validation), JWT errors, and Multer errors to `{ success: false, message, error, stack? }`.
- Successful responses use the envelope `{ success, message, data }`. Paginated lists return `{ meta: { page, limit, total }, <pluralKey>: [...] }`. Build them with `calculatePagination(pick(req.query, ["page", "limit"]))` from `utils/paginationCalculation.ts` and `utils/pick.ts`.
- **"Today" is the user's local day:** `Auth.timezone`, defaulting to `Europe/London`. Use the helpers in `utils/userDay.ts`:
  - `getUserTimeZone` and `getUserToday(tz)`. Use `.day` and `.dayRange` for calendar-day fields, and `.instantRange` for timestamps such as intake rows.
  - `withCalendarDays` and `toCalendarDay` for incoming dates.
  - `sameDayWhere` matches one day, including older rows stored as raw timestamps.
- `getDayBounds(date)` (`utils/getDayBounds.ts`) is the plain UTC day.

### Data model
- All models are in `prisma/schema.prisma`. `Auth` is the user, and every user-owned model has an `authId` ObjectId relation to it. Import the client singleton from `utils/prisma.ts`, and import enums from `@prisma/client`.

### Subscriptions (RevenueCat)
- **Premium means `Subscription.status === ACTIVE`.** There is one `Subscription` row per user (`authId @unique`).
- **The app must call `Purchases.logIn(<Auth.id>)`.** RevenueCat's `app_user_id` is the user id.
- `Package` (`modules/package`) maps a RevenueCat `revenueCatProductId` to an `entitlementId`. Packages are soft-deleted (`isDeleted`). Look a package up with `findPackageByProduct`.
- **`syncFromRevenueCat(authId)` in `subscription.service.ts` is the only writer of subscription state.** `test-purchase` is the one exception. It always re-reads the subscriber from the RevenueCat REST API (`utils/revenuecat.ts`), because webhook events can arrive out of order. Status rules:
  - entitlement active (grace period included) → `ACTIVE`
  - refunded → `CANCELLED`
  - billing issue → `BILLING_ISSUE`
  - anything else → `EXPIRED`
- A `CANCELLATION` event only means auto-renew was turned off (`cancelAtPeriodEnd = true`). **Never end Premium on it.** Refunds arrive as `CANCELLATION` with `cancel_reason: CUSTOMER_SUPPORT`.
- **Webhook:** `POST /subscriptions/webhook/revenuecat` is authenticated by the `Authorization` header (`REVENUECAT_WEBHOOK_SECRET`) and parsed by `express.json()`.
- **Payments:** `paymentServices.upsertRevenueCatPayment` records them, deduped by `transactionId`. `PRODUCT_CHANGE` is not a payment; the charge arrives as `RENEWAL` or `INITIAL_PURCHASE`.
  - `environment: "SANDBOX"` payments (test purchases included) are excluded from revenue through `LIVE_PAYMENT`.
- **`POST /subscriptions/test-purchase`** returns 404 when `NODE_ENV=production`.

### API docs (Swagger)
- The docs are served at `/api-docs` (UI) and `/api-docs.json`. They are hand-written and not generated from the code.
- Helpers live in `src/app/docs/`:
  - `crud()` in `crud.ts` documents the standard POST /, GET /, [GET /:id], PATCH /:id, DELETE /:id set.
  - `op`, `ok`, `paged`, `ref`, `jsonBody`, and `formBody` are in `helpers.ts`.
  - Field builders are in `fields.ts`.
  - Component schemas and `ENUMS` are in `components.ts`.
- **`ENUMS` in `components.ts` duplicates the Prisma enums by hand.** Update it whenever you change a schema enum or model, and also update the matching `*.swagger.ts` whenever routes change.

### Notifications
- To notify a user, call `createNotification` or `notify` in `modules/notification/notification.utils.ts`. Do not write to `prisma.notification` directly. These helpers save the in-app `Notification` row and then send an FCM push to `Auth.fcmToken`.
  - `createNotification` is awaitable and returns `null` on a duplicate.
  - `notify` is fire-and-forget: it never throws.
- `dedupeKey` is a unique field. Pass a deterministic key, such as `appt:<id>`, to make a notification idempotent. A P2002 error on that key is swallowed.
- Push rules:
  - Pushes go only to `ACTIVE` accounts that have a token.
  - `DIGEST` and `APPOINTMENT` types share a cap of 3 pushes per user per 24 hours.
  - Invalid FCM tokens are cleared automatically.
  - `push: false` creates the in-app notification without sending a push.
- If the Firebase env vars are missing, `utils/firebase.ts` returns `null` and push is silently disabled. In-app notifications still work.
- To add a notification type, add it to the `NotificationModelType` enum in Prisma and to `ENUMS` in `docs/components.ts`.

### Scheduled jobs
- `src/server.ts` calls `startNotificationJobs()` (`jobs/notification.jobs.ts`) once the server is listening. It runs an hourly cron (`0 * * * *`), but only for active `USER` accounts that have an `fcmToken`. For each of those users it computes the local hour from `Auth.timezone` (defaulting to Europe/London). All of these sends are for premium users only:
  - 08:00: the morning digest.
  - 20:00: appointment reminders.
  - 20:00: a reminder that the subscription is ending, sent only when `cancelAtPeriodEnd` is set.

  `dedupeKey` keeps each job idempotent. Call `runHourlyNotificationJob(now)` directly to trigger a run by hand.
- `startMedicationReminderJob()` (`jobs/medication.jobs.ts`) runs every minute. It sends a push at each `Medication.reminderTimes` entry ("HH:mm" in the user's local time) while the course is active (`startDate..endDate`), and checks the previous minute too so a late tick is not missed. It is not premium-gated and not part of the daily push cap.
  - **UK GDPR:** a medication push must never contain the medication name. The text is always "Medication reminder", and `referenceId` carries the medication id for deep-linking.
- Tracker dates are stored as calendar days at **UTC midnight**: appointments, checklists, medication and supplement courses, symptoms and cycles. The jobs rely on this, so do not store local-time offsets in those fields.
  - Services normalise incoming dates with `withCalendarDays`. A `YYYY-MM-DD` value is kept as-is; any other instant is mapped to the user's local day.
- **Checklist:** the first time a user opens their checklist (`GET /checklists` or `/today`), the `ChecklistTemplate` rows are copied into it once, dated today. `Auth.checklistSeededAt` records this.
- **Revenue is reported in GBP.** `Payment.amountGbp` and `amountRefundedGbp` are converted when a payment is saved, using `toGbp` in `utils/currency.ts`, whose fixed USD and EUR rates are constants in that file. Dashboard sums use only these fields.
- **`DELETE /profile` permanently deletes the account and all its data**, including S3 files and the RevenueCat subscriber (UK GDPR). Payments are kept but unlinked from the user. When you add a user-owned model, add it to `deleteAccount` in `profile.service.ts`.

### Email
- `utils/sendEmail.ts` fills the `{{placeholder}}` values in the HTML templates under `src/app/emailTemplates/` and POSTs the result to `SEND_EMAIL_URL`.
