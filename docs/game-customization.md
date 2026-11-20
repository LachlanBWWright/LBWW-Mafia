# Game customisation

Web and React Native use the same validated setup contracts. The host can configure a custom lobby, save a preset, import/export a game pack, and review the resulting setup before joining. The game server enforces these rules; client controls alone do not determine match behaviour.

## Setup and game packs

`shared/game/lobbyConfig.ts` defines the setup: 2–64 seats, public/hidden ballots, weighted or tier-balanced role selection with limits, or explicit role slots, optional `rules`, and up to 16 authored `customRoles`. Custom role selections use `custom:<id>`. Duplicate role IDs/names and unresolved custom role references are rejected.

`shared/game/gameRules.ts` defines these optional groups. Omitted settings resolve to shared defaults so existing presets continue to work. Legacy setups with no `rules` object retain their initial day pace of `size × 4 + 10` seconds and the existing shorter later-round timing; supplying rules uses the explicit timing defaults or overrides.

| Group           | Implemented settings                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `timing`        | Opening discussion, day and night duration; finish phases when eligible players submit                                       |
| `voting`        | Majority/plurality, spare everyone/random elimination on ties, allow or lock vote changes                                    |
| `reveal`        | Reveal role/faction/nothing on death; expose or hide the possible role pool                                                  |
| `communication` | Whispers, per-player phase message limit (zero means unlimited), last words, spectator chat                                  |
| `bots`          | Fill empty seats with built-in bots; casual/standard/challenging difficulty and cautious/argumentative/deceptive personality |
| `presentation`  | Classic/noir/midnight theme and classic/concise announcements                                                                |

A portable game pack is strict JSON with `format: "lbww-mafia"`, `version: 1`, a name, optional description, and a validated `config`. JSON imports are limited to 100 KB; encoded pack payloads to 300,000 characters. Future versions and malformed input are rejected without replacing the current editor setup. Shared links carry an encoded pack and do not require a public preset database. Mobile supports importing/pasting and native file sharing; web supports JSON and share links.

Custom lobby creation persists the validated setup as a snapshot. The server validates, copies and recursively freezes that setup when constructing the room. Later edits to a preset or pack cannot alter an existing room or match. No live rule-editing endpoint is provided.

## Authored roles and sandbox

Authored roles are declarative data, never uploaded JavaScript. Each has a stable ID, display name, description, Town/Mafia alignment, and a night effect: **protect**, **investigate**, **block**, **attack**, or **redirect**. Redirect sends the target's action to the redirector. Restrictions include charges, cooldown nights, self-target eligibility and consecutive-target limits. Investigation accuracy applies only to investigation. Authored roles win with their faction; the current schema accepts only `winCondition: "faction"`.

The role sandbox executes actual role commands, visit resolution and combat against scripted participants for one to five nights. Inputs include the target's alignment, an incoming attack, and a deterministic random sample. Participants revive between rows to keep later trials valid; the authored actor's charges, cooldown and targeting history carry over. This tests ability behaviour and restrictions, rather than predicting whole-match balance or simulating a persistent lobby.

## Joining and information visibility

Custom rooms expose a bounded, validated public setup preview at `GET /api/lobbies/:roomId/preview`. Web and mobile show rules and custom role definitions before an explicit **Join match** (or **Watch match**). The preview excludes ownership, user identities, assignments, selection weights and hidden role pools. Role pools appear only when enabled. Only a 404 means that the room has no custom setup; storage/network errors offer retry. Mobile retains local practice when an explicit room's preview is unavailable.

Unparameterised mobile matchmaking skips the custom-room lookup. Within a match both clients show the same public setup summary. Private assignments remain governed by the server's normal snapshot visibility rules.

## Private persistent lobbies and replay discussion

Signed-in players can create private persistent lobbies, invite members with a code, rotate hosts, attach completed matches they participated in, and vote for the next validated game pack. Scores derive from persisted participants and outcomes. Membership, persistent lobby/round limits and concurrent retries are enforced transactionally; submitting the same round twice does not double-count it. Setup voting is one replaceable vote per member. Creating a pack vote does not automatically create or change a lobby.

Completed-match participants can annotate public replay events, delete their own annotations, and nominate a decisive player/event. Whispers are excluded from discussion indices. Outsiders and live matches cannot access discussion, nominees must be participants, and each player has one replaceable nomination. The shared discussion cap is 200 annotations, including concurrent writers.

## Local database and verification

Persistent lobbies and discussion require `nextjs/drizzle/0007_campaign_discussion.sql` in addition to previous migrations. Apply it to a disposable local PostgreSQL database before integration/E2E checks:

```sh
export DATABASE_URL=postgresql://postgres:localtest@127.0.0.1:55439/mafia_customization
export DATABASE_URL_UNPOOLED="$DATABASE_URL"
pnpm --dir nextjs db:migrate
pnpm --dir nextjs test:integration
```

Use explicit local database URLs and dummy authentication/backend settings when building or running browser tests; do not use production credentials. Relevant coverage includes shared configuration/pack/privacy tests, server custom-role/sandbox/bot/rule tests, PostgreSQL persistent lobby/discussion integration tests, web customisation and prejoin Playwright tests, and web/mobile Storybook interactions and visual checks. Keep both platform typechecks and relevant lint checks passing. Regenerate visual baselines only through the documented pinned Playwright workflow in `DEPLOYMENT.md`.

Mobile visual projects named `*-light` exercise the operating system’s light preference; the mobile app currently retains its fixed dark palette. They do not establish light-theme parity with the web client. Room presentation backgrounds (classic, noir and midnight) remain separate game settings shared by both clients. Shared per-user light/dark theme support is tracked as a future improvement.

## Tracked follow-ups

The following optional extensions remain **unimplemented**: trial/defence voting phases, neutral/custom individual win conditions, and per-user audio/sound preferences. Add shared contracts, server behaviour, web/mobile controls and parity tests when implementing them. Setup warnings are structural guidance, not a statistically validated balance rating.
