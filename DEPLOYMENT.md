# Production deployment

## Architecture

- Deploy `nextjs/` to Vercel.
- Deploy `Dockerfile.game-server` to a container platform that supports long-lived WebSockets.
- Use managed PostgreSQL (Supabase is supported) and run the checked-in Drizzle migrations before releasing the web app.

The Rust server currently keeps active rooms in process memory. Run exactly one replica until room state is moved to a shared store. Scale-to-zero or instance replacement disconnects active games, so configure a minimum of one warm instance and graceful termination.

## Rust game server

Build and run locally:

```bash
docker build -f Dockerfile.game-server -t mernmafia-game-server .
docker run --rm -p 8000:8000 \
  -e ALLOWED_ORIGINS=https://your-app.vercel.app \
  -e CAPTCHA_KEY=your-recaptcha-secret \
  mernmafia-game-server
curl --fail http://localhost:8000/readyz
```

Required production variables:

- `ALLOWED_ORIGINS`: comma-separated HTTPS origins allowed to open the browser connection.
- `CAPTCHA_KEY`: Google reCAPTCHA server secret.
- `PORT`: injected by most container platforms; defaults to `8000`.
- `ROOM_SIZE`: defaults to `13`.
- `DAY_SECONDS`: day phase duration; defaults to `60`.
- `NIGHT_SECONDS`: night phase duration; defaults to `45`.

Never enable `DEBUG=true` in production; it bypasses CAPTCHA verification.

Configure the platform health check as `GET /readyz`. Forward WebSocket upgrades and allow connections at `/ws/{roomId}`. Deploy the immutable image produced from a reviewed commit and retain the previous image digest for rollback.

## Vercel

Set the project root directory to `nextjs`. Configure:

- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `DATABASE_URL`
- `BACKEND_SECRET`
- `NEXT_PUBLIC_SOCKET_BACKEND=rust`
- `NEXT_PUBLIC_SOCKET_URL=https://your-game-server.example.com`
- `NEXT_PUBLIC_CAPTCHA_TOKEN`

Run `pnpm --dir nextjs run db:migrate` against the production database before promoting a schema-dependent release. Configure the Google OAuth callback for the final Vercel/custom domain.

## Release gates

For the focused Next.js + Rust path, run either:

```bash
pnpm run test:next-rust       # lint, typecheck, unit tests, production build, Rust checks, live smoke test
pnpm run test:next-rust:smoke # start Rust locally and verify two WebSocket clients can begin a game
pnpm run test:gameplay:all    # TypeScript characterization, parity, Rust logic, and live gameplay protocol
pnpm run test:coverage        # measured TypeScript, Next shared-client, and Rust game-core coverage gates
```

The smoke script uses port `18000` by default. Override it with `NEXT_RUST_TEST_PORT` when necessary.

```bash
pnpm install --frozen-lockfile
pnpm run lint
pnpm --dir server test
pnpm --dir nextjs test
pnpm --dir nextjs build
pnpm --dir mobile run lint
pnpm --dir mobile exec tsc --noEmit
cargo fmt --manifest-path rust/Cargo.toml --all -- --check
cargo clippy --locked --manifest-path rust/Cargo.toml --workspace --all-targets -- -D warnings
cargo test --locked --manifest-path rust/Cargo.toml --workspace
docker build -f Dockerfile.game-server .
```

Rollback by setting `NEXT_PUBLIC_SOCKET_BACKEND=socketio` and restoring its URL, or by redeploying the previous Rust container digest. Because `NEXT_PUBLIC_*` values are compiled into the client, changing the backend requires a Vercel deployment.
