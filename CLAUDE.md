# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev`: run with hot reload (`tsx watch src/server.ts`)
- `npm run build`: `prisma generate && tsc` to `dist/`
- `npm start`: run the compiled `dist/server.js`
- `npm run lint` / `npm run lint:fix`: ESLint
- `npm run format` / `npm run format:check`: Prettier (double quotes, semicolons, `trailingComma: es5`, `arrowParens: avoid`)
- `npm run seed:admin`: create the admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- `npx tsc --noEmit`: type-check only
- `npx prisma db push`: sync `prisma/schema.prisma` to the database. The database is MongoDB, so there are no migrations. `npx prisma generate` runs on `postinstall`.

There is no test suite.

## Stack

Express 5, TypeScript (ESM, `module: NodeNext`), Prisma 6 on MongoDB, Zod 4, JWT auth, Stripe subscriptions, AWS S3 uploads through multer memory storage, and email sent over HTTP to an external service (`SEND_EMAIL_URL`).

- **ESM imports must use the `.js` extension**, even from `.ts` files (`import x from "./foo.js"`).
- The tsconfig is strict and also sets `noUncheckedIndexedAccess`, `noUnusedLocals`, and `noUnusedParameters`. Prefix unused parameters with `_`.
- Config is read from env vars in `src/app/config/index.ts`. The AWS variables (`S3_BUCKET_ACCESS_KEY`, `S3_BUCKET_SECRET_ACCESS_KEY`, `S3_BASE_URL`, `AWS_REGION`, `AWS_BUCKET_NAME`) are missing from `.env.example`.

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
- `requirePremium` lets the request through only when the user's `Subscription.status === ACTIVE`. Most user-data modules apply `router.use(authorize(UserRole.USER), requirePremium)`.
- `validate(schema)` **only validates `req.body`. It does not replace it**, so Zod defaults and coercions such as `z.coerce.date()` and `.default([])` do not reach the service. The exception is `validate(schema, { formData: true })`: it parses `req.body.payload` as a JSON string and **does** replace `req.body`. Use that form for multipart routes.
- File uploads use `upload` / `uploadImage` (images only: jpeg/png/webp, max 5MB) together with `uploadToS3` / `deleteFromS3`, all in `utils/awss3.ts`.

### Errors and responses
- Throw `new ApiError(status, message)` (`classes/ApiError.ts`). `middlewares/globalErrorHandler.ts` maps ApiError, ZodError, Prisma errors (P2002, P2025, P2003, validation), JWT errors, and Multer errors to `{ success: false, message, error, stack? }`.
- Successful responses use the envelope `{ success, message, data }`. Paginated lists return `{ meta: { page, limit, total }, <pluralKey>: [...] }`. Build them with `calculatePagination(pick(req.query, ["page", "limit"]))` from `utils/paginationCalculation.ts` and `utils/pick.ts`.
- Per-day uniqueness, as in symptoms, uses `getDayBounds(date)` from `utils/getDayBounds.ts`.

### Data model
- All models are in `prisma/schema.prisma`. `Auth` is the user, and every user-owned model has an `authId` ObjectId relation to it. Import the client singleton from `utils/prisma.ts`, and import enums from `@prisma/client`.

### Subscriptions (Stripe)
- `/api/v1/subscriptions/webhook` receives the raw body: `app.ts` mounts `express.raw` for that path **before** `express.json()`. Keep that order.

### API docs (Swagger)
- The docs are served at `/api-docs` (UI) and `/api-docs.json`. They are hand-written and not generated from the code.
- Helpers live in `src/app/docs/`:
  - `crud()` in `crud.ts` documents the standard POST /, GET /, [GET /:id], PATCH /:id, DELETE /:id set.
  - `op`, `ok`, `paged`, `ref`, `jsonBody`, and `formBody` are in `helpers.ts`.
  - Field builders are in `fields.ts`.
  - Component schemas and `ENUMS` are in `components.ts`.
- **`ENUMS` in `components.ts` duplicates the Prisma enums by hand.** Update it whenever you change a schema enum or model, and also update the matching `*.swagger.ts` whenever routes change.

### Email
- `utils/sendEmail.ts` fills the `{{placeholder}}` values in the HTML templates under `src/app/emailTemplates/` and POSTs the result to `SEND_EMAIL_URL`.
