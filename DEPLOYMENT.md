# Production deployment

## Architecture

- Deploy the Next.js application to Vercel.
- Deploy game rooms with PartyServer on Cloudflare Workers and Durable Objects in your Cloudflare account.
- Use managed PostgreSQL and apply the checked-in Drizzle migrations before releasing schema-dependent changes.

The root `wrangler.jsonc` configures the Worker entry point, a `Main` Durable Object binding, and a SQLite-class migration for new room storage. The Worker routes `/parties/main/:room` to an isolated game room. Clients receive the Worker origin as their socket URL; they add the room path themselves.

Active games live in memory with hibernation disabled. A Worker replacement or crash can end a game; restoring an unfinished match is intentionally out of scope for these short games. Room configuration, closed-room markers, and the existing completed-history upload outbox remain durable. No legacy room-data import or export is required.

## Cloudflare game server

Install dependencies and validate the Worker locally before deployment:

```bash
pnpm install --frozen-lockfile
pnpm --dir server run build:partyserver
pnpm --dir server run test:worker
```

These checks run locally without Cloudflare credentials. `pnpm run dev:local` starts the local Wrangler runtime alongside Next.js and PostgreSQL; see the root README for prerequisites.

Authenticate Wrangler with your Cloudflare account for deployment. Configure **each** named environment separately, using staging and production application origins and different backend credentials:

```bash
pnpm --dir server exec wrangler login
pnpm --dir server exec wrangler secret put BACKEND_SECRET --config ../wrangler.jsonc --env staging
pnpm run deploy:partyserver --env staging --var NEXTJS_URL:https://YOUR_STAGING_HOST
```

Promote with `--env production` after staging acceptance. The production `NEXTJS_URL` is checked into `wrangler.jsonc` as `https://mern-mafia.vercel.app`; update that value if the web domain changes. `NEXTJS_URL` must be the HTTPS origin of the corresponding Vercel application, without a trailing slash. `BACKEND_SECRET` must exactly match that Vercel environment. It authorizes lobby configuration, lobby closure, and completed-history requests. Do not use the local default origin for a deployed environment.

For the first production deployment, supply the existing Vercel production `BACKEND_SECRET` through a protected JSON or dotenv file and Wrangler's `--secrets-file` option. This uploads the code, binding, and secret together. Never commit that file or pass the secret value as a command argument. Subsequent `pnpm run deploy:partyserver --env production` deployments preserve the Cloudflare secret.

Use the `https://…workers.dev` origin reported by Wrangler, or your configured HTTPS custom domain, for all client socket settings. The room WebSocket uses `wss://…/parties/main/:room`. Staging and production have separate Durable Object namespaces. Keep the initial migration and subsequent migration history in version control; do not recreate a production namespace during rollback.

The production Worker is `lbww-mafia-game` in Cloudflare account `31638ade12e7d4e4799c4600ed82b17f`, at `https://lbww-mafia-game.lachlanbwwright.workers.dev`. Use that origin for production `NEXT_PUBLIC_SOCKET_URL` and `EXPO_PUBLIC_SOCKET_URL`, with the corresponding backend selector set to `partyserver`. Electron's `socketUrl` uses the same origin. Rebuild clients after changing these settings.

CI validates the bundle and runs local Worker tests. The production deployment job described below additionally needs dedicated Cloudflare and Vercel tokens; normal builds and tests do not. Deployment protection on Vercel must permit authenticated Worker-to-application requests.

References: [PartyServer](https://github.com/cloudflare/partykit/tree/main/packages/partyserver), [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/), [Worker environments](https://developers.cloudflare.com/workers/wrangler/environments/), [Durable Object migrations](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/).

## Vercel

Import the repository into Vercel with these project settings:

- Root Directory: `nextjs`.
- Framework Preset: Next.js.
- Node.js Version: 24.x (also pinned in `nextjs/package.json`).
- Enable **Include source files outside of the Root Directory in the Build Step** so the app can use the `shared` and `db` workspace packages.
- Leave the Output Directory at the Next.js default (`.next`).

The checked-in `nextjs/vercel.json` supplies the install and build commands. Clear any project-level command overrides that still use `pnpm --dir nextjs`, since commands now run inside `nextjs`.

Set these environment variables for each deployment environment:

- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`: direct connection to the same PostgreSQL database/branch when using Neon pooling.
- `BACKEND_SECRET`
- `NEXT_PUBLIC_SOCKET_BACKEND=partyserver`
- `NEXT_PUBLIC_SOCKET_URL`: deployed PartyServer endpoint.

Generate independent random values for `AUTH_SECRET` and `BACKEND_SECRET` (for example, `openssl rand -hex 32`). Use the same `BACKEND_SECRET` on PartyServer. CAPTCHA keys and tokens are not required.

For Neon, connect its Vercel Marketplace integration to the project and deployment environment. It supplies `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct). Application requests use the pooled URL; Drizzle migrations and PostgreSQL message notifications automatically use the direct URL. Keep both pointed at the same branch, including preview deployments. Local PostgreSQL only needs `DATABASE_URL`.

`DIRECT_MESSAGES_DATABASE_URL` remains an optional session-capable override for notifications; it takes precedence over `DATABASE_URL_UNPOOLED`. Migrations and notifications reject known Neon pooled endpoints rather than attempting session-dependent operations through PgBouncer. Drizzle loads `nextjs/.env.local` when invoked from that directory (including `pnpm --dir nextjs run db:migrate`) and only requires database configuration, not Google OAuth credentials.

The application uses certificate-verified TLS for Neon URLs. Its postgres.js driver does not support libpq's `channel_binding` parameter, so the application strips that parameter instead of sending it as a PostgreSQL startup setting. Production request pools allow two connections per instance, expire idle connections after five seconds, and disable prepared statements for pooler compatibility.

Neon pooled connections omit per-session startup timeouts, which PgBouncer cannot preserve. Set the application role's defaults once through the direct connection (replace `your_app_role` with the role used by the application):

```sql
ALTER ROLE your_app_role SET statement_timeout = '10s';
ALTER ROLE your_app_role SET idle_in_transaction_session_timeout = '10s';
```

These defaults apply to new database sessions. Direct/local application connections retain the same timeouts in their startup configuration. Configure `TRUSTED_CLIENT_IP_HEADER` only when the hosting ingress is confirmed to overwrite and validate that header; otherwise leave it unset.

Register `https://YOUR_HOST/api/auth/callback/google` with the Google OAuth web client and configure its consent screen for the intended users. Preview deployments need their own registered callback host and a separate database; do not run integration tests against the production database.

Before promoting a schema-dependent release, run the checked-in migrations from the repository root with the target database environment variables supplied to the command:

```bash
pnpm --dir nextjs run db:migrate
```

Validate migrations and `pnpm --dir nextjs run test:integration` against a dedicated staging/test database first. Include migration `0006` and all required workspace source files in the release commit. Migrations are deliberately separate from the Vercel build so ordinary preview builds do not migrate production.

After deployment, verify Google sign-in, authenticated profile and lobby creation, and `GET /api/health` with `Authorization: Bearer <BACKEND_SECRET>` (expect HTTP 200 and `status: ready`). Confirm the deployed PartyServer host can load lobby configuration and persist a completed match. Its `NEXTJS_URL` must point to this application's public origin; deployment protection must allow those backend requests.

References: [Vercel monorepos](https://vercel.com/docs/monorepos), [Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Neon integration variables](https://neon.com/docs/guides/vercel-managed-integration), [Neon pooling limitations](https://neon.com/docs/connect/connection-pooling).

### Current Supabase configuration

Production uses the `lbww-mafia` Supabase project (`ysuyebvbarspkaoxssuv`). Both `DATABASE_URL` and `DATABASE_URL_UNPOOLED` use its verified session pooler on port 5432. Session pooling supports migrations and PostgreSQL `LISTEN/NOTIFY`; do not replace the notification URL with a transaction-pooler connection. The checked-in migrations through `0006` have been applied.

Vercel currently shares several integration variables with preview/development. Provision an isolated staging database before running integration tests or migrations in a preview. CI's database tests use their own disposable PostgreSQL service.

## Continuous deployment

`.github/workflows/ci.yml` runs server, Next.js, web browser/Storybook, and mobile checks for pushes and pull requests targeting `master` or `dev`, and supports manual dispatch. After all four jobs succeed on `master`, the `deploy-production` job:

1. Checks the deployment credentials and rejects an outdated commit.
2. Pulls Vercel production configuration and masks downloaded server credentials in logs.
3. Applies database migrations and builds the production web artifact with Node 24.
4. Deploys the production Worker with the matching Vercel `BACKEND_SECRET`.
5. Deploys the prebuilt web artifact and verifies database readiness, room authorization, and a real WebSocket connection. The verifier closes its temporary room.

Production deployments run serially and are not cancelled midway through a migration or upload. GitHub's `Production` environment permits deployments only from `master`. `nextjs/vercel.json` disables Vercel's independent Git deployments, so production waits for CI. Automatic hosted previews are also disabled: their inherited settings still select the retired backend and share production credentials. GitHub browser tests use isolated local services. Re-enable previews only after configuring a separate staging database, backend secret, PartyServer Worker, and matching web origin. Native application packages remain separate release artifacts and must use the same production API and Worker origins.

The GitHub `Production` environment has these nonsecret variables configured:

- `CLOUDFLARE_ACCOUNT_ID=31638ade12e7d4e4799c4600ed82b17f`
- `VERCEL_ORG_ID=team_RpwulZxphIvv0XCpBiTh5mGN`
- `VERCEL_PROJECT_ID=prj_HjKT1SqYDo9Ogp9wWKcNpxS7fosB`

Add these dedicated deployment secrets directly in [GitHub's Production environment](https://github.com/LachlanBWWright/LBWW-Mafia/settings/environments):

- `CLOUDFLARE_API_TOKEN`: create an account-restricted token in [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) with **Workers Scripts: Edit** and **Account Settings: Read** for the account above. The current Worker uses no KV, zone routes, or custom domains. If these are added later, grant their corresponding permissions explicitly.
- `VERCEL_TOKEN`: create a token in [Vercel Tokens](https://vercel.com/account/tokens), scoped to `lachlanbwwrights-projects` (and the `lbww-mafia` project if supported). Set an expiry that matches the team's rotation schedule.

The workflow targets Vercel with `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`. Keep the `--scope` flag off its pull, build, and deploy commands: explicit scope resolution performs a user lookup that returns HTTP 404 for the project's token, even though project access is authorized.

Local CLI OAuth sessions are not CI credentials. Vercel rejects token creation through the current CLI app login, and Cloudflare's Wrangler OAuth scope cannot create API tokens. Never commit deployment tokens or production env files. `.vercel/` is ignored; the deployment job removes downloaded credentials even after a failed release.

After the workflow and release source are merged into `master` and the secrets are configured, pushes deploy automatically. To rerun all checks and release the current `master` manually:

```bash
gh workflow run ci.yml --ref master
```

No production deployment runs for pull requests or `dev`. A failed smoke check fails the deployment job; it does not roll back database changes automatically. Use the matching previous Vercel deployment and Worker version if rollback is necessary, preserving the Durable Object namespace. Review schema compatibility before reverting code.

References: [Cloudflare GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/), [Vercel Actions workflow](https://vercel.com/guides/how-can-i-use-github-actions-with-vercel), [Vercel Git deployment controls](https://vercel.com/docs/project-configuration/git-configuration).

## Mobile app

The Expo client must be built with its production API and PartyServer URLs configured:

- `EXPO_PUBLIC_TRPC_URL`
- `EXPO_PUBLIC_SOCKET_BACKEND=partyserver`
- `EXPO_PUBLIC_SOCKET_URL`

App Store and Play Store distribution also requires platform bundle identifiers, signing credentials, and store listings. Those are not currently configured in `mobile/app.json`.

CAPTCHA verification is temporarily disabled for web and mobile joins. No CAPTCHA keys or tokens are required.

## Release checks

Browser jobs use `mcr.microsoft.com/playwright:v1.62.1-noble` so browser binaries and fonts match the screenshot baselines. The web job uses a disposable PostgreSQL service reachable as `postgres`; it does not run Docker inside the test container. Update the image in both browser jobs and `scripts/visual-baselines.sh` together with the locked Playwright version.

On Linux, after installing workspace dependencies, reproduce the visual suites in the same image:

```bash
bash scripts/visual-baselines.sh all
```

To intentionally update a suite, use `web`, `mobile`, or `mobile-storybook` followed by `--update`. Review the generated screenshots, then rerun that suite without `--update` and commit the comparison baselines. The helper disables loading local Expo env files and uses dummy web configuration. It supports rootless Docker. Generated galleries and reports remain ignored; all comparison baselines under `*-snapshots/` must be tracked. Web Storybook checks baseline completeness before launching browser tests, so a missing fixture fails immediately.

CI runs server, Next.js, web browser, and mobile checks on pushes and pull requests to `master` and `dev`. To run the core checks locally:

```bash
pnpm install --frozen-lockfile
pnpm run lint
pnpm --dir server run typecheck
pnpm --dir server run test
pnpm --dir server run build:partyserver
pnpm --dir server run test:worker
pnpm run test:e2e
pnpm --dir nextjs run typecheck
pnpm --dir nextjs run test
pnpm --dir nextjs run db:migrate
pnpm --dir nextjs run test:integration
pnpm --dir nextjs run build
pnpm --dir mobile run typecheck
pnpm --dir mobile run test
```

Keep the previous Vercel deployment and Cloudflare Worker version available for rollback. Promote the matching staging configuration together across web, mobile, and Electron; verify a complete multiplayer match, reconnects, custom lobby creation, and completed history before production. Realtime transports intentionally keep the existing event protocol. A rollback must preserve the Cloudflare Durable Object namespace. `NEXT_PUBLIC_*` values are compiled into the client, so changing the selected backend or endpoint requires a new client deployment.

### ChatGPT subscription-powered AI characters

The Next.js browser client disables ChatGPT AI setup and explains that it is available in desktop and mobile apps. It makes no companion requests. The same Next.js UI enables native setup when loaded in the Electron app with its isolated preload bridge.

Electron embeds the callback listener, encrypted `safeStorage` credentials, Responses streaming and PartyServer bot runner in its main process. Configure the website and game server in `desktop/config.json` before packaging. React Native uses the local `MafiaChatGPT` Expo module, SecureStore and on-device streaming/bot sockets. A rebuilt native app is required; Expo Go and mobile web do not contain the module. See [desktop distribution](desktop/README.md) and [mobile setup](mobile/README.md).

No OpenAI API key is required or provided as fallback. The published [local flow](https://developers.openai.com/siwc/token-sharing-open-source/sign-in) specifies an on-device loopback callback; hosted browser inference remains disabled until a supported hosted integration exists. Live authorization and a complete AI match on each target remain release acceptance checks.
