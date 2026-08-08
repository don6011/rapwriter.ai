# RapWriter Release Gate

Run the local release-candidate gate before every deployment:

```powershell
bun run test:rc
```

This blocks release on lint, TypeScript, unit tests, mobile and desktop browser journeys, or the production build.

Run the focused authorization and response-header contract while working on API routes:

```powershell
bun run test:security
```

Deployment probes:

- `/api/health/live` confirms the application process is serving requests.
- `/api/health` confirms the application can reach Supabase.
- Every response includes `X-Request-ID` and `X-RapWriter-Release` for production incident tracing.

Never commit `.env`, `.env.local`, service-role keys, database passwords, or Stripe secrets. Start new environments from `.env.example` and keep real values in the deployment provider or an ignored local file.

Run the database lifecycle gate against the intended Supabase staging project before a release candidate is promoted:

```powershell
bun run test:rc:database
```

The database gate requires `NEXT_PUBLIC_SUPABASE_URL`, a Supabase publishable or anon key, and `SUPABASE_SERVICE_ROLE_KEY`. It creates disposable users, verifies tenant isolation and the main artist, producer, collaboration, notification, and admin lifecycles, then cleans up those users. Confirm the environment points to staging before running it.

Producer release coverage includes the secure media boundary: a beat cannot be approved without a separate owner-scoped Store preview of 30 seconds or less. The gate uploads disposable master and preview objects, verifies the approval transition, and removes both objects during cleanup.

Stripe checkout is intentionally outside this gate until billing is activated. Before launch, add Stripe test-mode checkout, portal, webhook, and entitlement reconciliation to the same release command.

## Manual Sign-Off

- Open Studio, Locker, Market, Profile, Producer HQ, and Admin on a phone viewport.
- Write in Hook and Verse 1 while a beat plays; confirm section tabs and the cursor remain visible.
- Confirm All Access clearly exposes Artist and Producer workspaces.
- Leave Add Beat and Add Service without saving; confirm both return to Producer HQ.
- Open artist requests and an owner storefront; confirm Producer HQ context is preserved.
- Verify locked rooms preview correctly and never activate without the required membership or ownership.
