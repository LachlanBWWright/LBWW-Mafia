# Gameplay and application reliability

## Lobby configuration

`shared/game/lobbyConfig.ts` owns role identifiers, count/uniqueness validation,
form conversion, and weighted/tier selection. The API validates before saving;
PartyServer reads `/api/lobbies/{roomId}` with its backend credential before admitting
players and caches the configuration in room storage. Configuration outages
reject joins rather than silently applying defaults. A missing record means a
public room. Ownership deletion first closes the game host and records a durable
closed flag. The room's configuration remains immutable.

The new migration creates `nextjs_custom_lobby`. Legacy session rows are retained
because this release does not require destructive cleanup.

## Connection recovery

The PartyServer adapter uses an unguessable connection capability and exponential
backoff (500 ms to 5 seconds). Mobile generates the capability with `expo-crypto`.
PartyServer reserves disconnected seats for 30 seconds. Returning connections retain
their player, role, votes, and selected actions, and receive a private snapshot of
roster, faction knowledge, phase, timer, and permissions. Other players' secret
roles are excluded. After the grace period the existing abandonment rule applies.
Native foreground events trigger an immediate connection attempt when needed.

Web stores the seat capability per room in tab session storage; native stores it
in SecureStore. Reloading or restarting can recover the same seat within the grace
period. Active game state remains in memory;
Worker replacement ends an unfinished game. Hibernation is explicitly disabled;
active-match checkpoints and recovery across process replacement are intentionally
out of scope for these short games. Socket.IO and
Supabase retain their compatibility transport behavior; the new seat recovery is
specific to the production PartyServer host and has transport/reducer regression tests.

## Direct messages

Messages and read markers are persisted in PostgreSQL. Sending a message emits
`pg_notify` inside its transaction, so other web instances receive only committed
notifications. Notifications contain IDs rather than full message bodies. SSE
subscribers refresh through the authenticated API. Each connection rotates after
four minutes; abort, cancellation, and setup failure all release subscriptions
and timers. Configure `DATABASE_URL_UNPOOLED` with a direct PostgreSQL connection when
`DATABASE_URL` uses Neon transaction pooling. Notifications use it automatically;
`DIRECT_MESSAGES_DATABASE_URL` is an optional higher-priority override. PostgreSQL
notifications are hints; clients retain polling as a recovery mechanism.

Web uses SSE plus 10-second refreshes. React Native uses 10-second foreground
polling because its fetch transport does not reliably expose streaming response
bodies across supported native runtimes. Both clients use the same pagination
limit and merge/deduplication function. This transport difference is intentional;
shared message-history tests and native foreground lifecycle tests cover it.
A future native streaming transport must retain the same contract and history.

## Verification

The web and mobile unit commands include application tests as well as shared
contracts. `pnpm --dir server run test:worker` exercises the actual local Cloudflare
Worker runtime, while Playwright boots Wrangler for multiplayer browser checks.
Neither requires a Cloudflare account or deployed Worker. Native boundary tests
mock Expo SecureStore and React Native AppState to exercise write ordering, restoration races, pause, and resume. These are not
emulator tests. Before a native release, also verify secure storage across a real
app restart and reconnect after backgrounding on iOS and Android devices.

Storybook contains live custom-lobby forms and message-thread states on both
platforms. Screenshot coverage includes phone/tablet themes and web desktop/RTL.
`STORYBOOK_TEST_GREP` can focus mobile captures during development; complete CI
runs omit it and validate the entire manifest.

## Safe writes and completed-result recovery

PartyServer stores completed results in `pending-history` before upload and schedules
an alarm before contacting the backend. Upload failures retain the result and
retry with bounded exponential delay and jitter. `onStart` schedules recovery;
`onAlarm` drains the outbox. PostgreSQL deduplicates by game ID; match and participant rows commit in
one transaction. This recovers completed results only: active-game recovery
across Worker replacement is intentionally out of scope. Existing completed-result
retry persistence is retained independently of active-match state.

PartyServer commands carry an ID and phase version. The client retries an
unacknowledged command up to three times; the host retains the last 128 IDs per
seat and rejects outdated phase versions. Day/night transitions advance the
version, preventing a delayed action from applying on a later day. Web and native
use the same adapter. Socket.IO and Supabase are compatibility transports and
retain their earlier action protocol; extending acknowledgements there is tracked
as a transport follow-up before either is used in production.

Direct-message sends preserve a command ID across retries of the same draft.
Unique sender/command IDs prevent duplicate writes; ID reuse with different
content is rejected. Message insertion, blocks, and friendship changes share a
transactional advisory lock for the user pair. Sends also lock account rows and
recheck current authorization after waiting. Google sign-in uses database uniqueness
and provider identity; email-based automatic linking is disabled.

## Sessions and resource limits

Mobile access tokens expire after 15 minutes. Refresh credentials are random,
kept in SecureStore, hashed in PostgreSQL, and rotated under a row lock. Sessions
expire after 30 days. Native refreshes share one in-flight operation and sign-out
wins over late responses. Device sessions can be revoked from either client.
Account credential version changes invalidate web sessions and revoke mobile
sessions. Google-only rollout revokes legacy password sessions. Native Google
login uses a browser-bound, one-time PKCE exchange; see `GOOGLE_AUTH.md`. `MOBILE_AUTH_SECRET` optionally supplies a dedicated
32+ character signing secret; otherwise a domain-separated key is derived from
`AUTH_SECRET`, never from the backend credential.

PostgreSQL maintains shared request buckets. Configure
`TRUSTED_CLIENT_IP_HEADER` only to a header your ingress overwrites and validates.
Without it, anonymous requests share one conservative bucket. Authenticated RPC
limits use account IDs as well. Google handoff, lobby creation, and refresh
are limited; HTTP bodies, RPC batch sizes, socket payloads, socket bursts, and room
connections are bounded. Database connection pools are bounded (two connections per production instance).
Direct/local connections set statement timeouts at startup. Neon pooled
connections require role-level timeout defaults; see `DEPLOYMENT.md`.
Backend/configuration requests have deadlines and reconnects use jitter.
CAPTCHA verification is temporarily disabled across web and native game joins.
Expired request buckets may be removed during database maintenance using
`DELETE FROM nextjs_request_limit WHERE window_start < now() - interval '1 day'`.

## Operations and recovery drills

Authenticated `GET /api/health` tests database availability. Backend-authenticated
GETs to PartyServer rooms expose connection counts, phase version, and pending-history
attempts, without roles or message content. Logs emit structured `history.retry`,
`history.persisted`, `connection.resumed`, `phase.delayed`, `rpc.error`, `rpc.slow`,
and SSE lifecycle events. RPC responses include a generated request ID. Alert on
repeated history retries, database unavailability, and delayed phases; route these
JSON events into the deployment's log/metric collector.

`scripts/db-recovery-drill.sh` performs a custom-format backup, restores it into a
separate disposable database named `mafia_restore_*`, and compares core row counts.
Set `DATABASE_URL` and `RESTORE_DATABASE_URL`; PostgreSQL 16 client utilities must
be available. The script refuses a source/target identity match and deletes its
temporary dump. Run against a stable fixture or quiescent source: concurrent writes
can make the row-count comparison fail. Actual production backup scheduling and
retention belong to the hosting configuration.

The fault/concurrency suite covers durable outbox restart, duplicate uploads,
transaction rollback, stale and duplicate game commands, blocked-message races,
Google PKCE exchange/replay, refresh rotation, device revocation, and native refresh /
sign-out races. Real iOS/Android restart and background-network drills still need
physical devices or simulators; mocked native boundaries do not establish those.

Completed history batches use small storage chunks and an atomic manifest write.
Room memory retains at most the last 1,000 conversation events and 1,000 actions;
older entries are omitted. Backend history requests permit up to 8 MiB, while
ordinary RPC bodies are limited to 128 KiB. Unconfirmed or outdated commands show
recovery feedback in both clients rather than silently disappearing.
