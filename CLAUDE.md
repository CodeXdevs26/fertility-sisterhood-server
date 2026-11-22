# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — run the server with `tsx watch src/server.ts`
- `npm run build` — `prisma generate && tsc` (output in `dist/`); `npm start` runs `dist/server.js`
- `npm run lint` / `lint:fix`, `npm run format` / `format:check` (ESLint 9 + Prettier)
- `npm run seed:admin` — create the admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- Prisma: schema is at `prisma/schema.prisma`; `postinstall` runs `prisma generate`. Use `npx prisma migrate dev` / `npx prisma db push` for schema changes.
- There is no test suite configured.

Copy `.env.example` to `.env` (DB URL, JWT secrets/expirations, Stripe keys, `SEND_EMAIL_URL`, admin creds). Env is read via `src/app/config/index.ts`.

## Architecture

Express 5 + TypeScript (ESM, `NodeNext`) + Prisma + Zod API for a fertility-tracking app. Because of ESM `NodeNext`, **relative imports must use the `.js` extension** (e.g. `import x from "./foo.js"`). `tsconfig` is strict with `noUncheckedIndexedAccess` and `noUnused*`, so unused locals/params fail the build.

Entry: `src/server.ts` creates the HTTP server → `src/app/app.ts` (middleware, Swagger, mounts `/api/v1` router, then `globalErrorHandler`). The Stripe webhook path (`/api/v1/subscriptions/webhook`) uses `express.raw` and must be registered before `express.json()`. CORS origins are hardcoded in `app.ts`.

### Module pattern

Each feature lives in `src/app/modules/<name>/` with `*.routes.ts`, `*.controller.ts`, `*.service.ts`, `*.validation.ts` (Zod schemas + inferred `T*` types), and `*.swagger.ts`. To add a module:
1. Create the files above; register the routes in `src/app/routes/index.ts`.
2. Register the swagger object in the `modules` array in `src/app/docs/swagger.ts`.

Routes compose middleware from `src/app/middlewares/`:
- `authorize(UserRole.USER)` — verifies the Bearer JWT, sets `req.user`, checks role; `authorize({ optional: true }, ...)` allows anonymous.
- `requirePremium` — requires an `ACTIVE` `Subscription` for the user (premium-only features like costs).
- `validate(zodSchema, { formData? })` — parses `req.body`; with `formData: true` it parses the JSON string in `req.body.payload` (used with multer uploads).

Controllers are wrapped with `handleAsyncRequest` and respond via `sendResponse`; errors are thrown as `ApiError(status, message)` and handled by `globalErrorHandler`. Services talk to Prisma directly (`utils/prisma.ts`), scope data by `authId` (the `Auth` user id), and paginate via `utils/paginationCalculation.ts`.

### Swagger docs

Docs are hand-built objects (no annotations): `src/app/docs/` has helpers (`crud.ts` generates CRUD paths, `fields.ts`/`helpers.ts` for schema fragments, `components.ts` for shared schemas/enum refs). When changing an endpoint's body or enum, update the matching `*.swagger.ts` and `components.ts`.

### Other integrations

Stripe subscriptions (`utils/stripe.ts`, `modules/subscription`), AWS S3 uploads (`utils/awss3.ts`, multer), email through an external HTTP service (`utils/sendEmail.ts`, templates in `emailTemplates/`), OTP flow (`modules/otp`). `socket.io` is a dependency but is not wired up in `server.ts`.
