# Match strategy and social features

The web and React Native clients share feature contracts and privacy rules. This document records behavior and release coverage for private notes, bot evaluation, spectators, parties, replays, and balance statistics.

## Private notes

Match notes and the suspicion board stay on the current device and are keyed by match, player, and signed-in account identity. Players can record claims, confirmed facts, and uncertain, trusted, or suspicious assessments. These entries never enter game events, public chat, replay history, or bot prompts. Starting another match selects a different notebook. The clear action removes the saved notebook.

Web uses local browser storage. Native uses chunked secure storage to keep entries within individual secure storage value limits; the Expo web capture uses local storage. Storage failures retain edits in the current view and display a recovery message. Device storage does not synchronize notes across platforms.

## Completed match replays

Replay access requires participation in the completed match or administrator access. Active, future, and invalid matches do not reveal private actions. Completed replays reveal roles and game actions. Whispers remain restricted to their sender and recipient, including when an administrator opens a replay.

New history entries include optional phase, day, and event kind metadata. Legacy histories retain their chronology without invented phase metadata. Replay presentation is shared across both clients.

## Balance statistics

Signed-in users can inspect recent completed matches. The query defaults to 200 matches and accepts at most 500. Role results count final-role player appearances and wins. Faction results count matches exposing a final faction and a win when at least one member of that faction won; neutral objectives can differ from faction outcomes. Draws remain in the denominator and are shown separately. Sample sizes are visible so small samples are not mistaken for reliable estimates.

Compositions use the initial roster when complete starting role reveal metadata exists. Older matches use a separately labelled final roster, which may omit roles that changed during play. The aggregate does not expose names, account IDs, lobby IDs, or chat.

## Visual coverage

Private note stories cover an active notebook and the waiting state. Party stories cover leaders, members, invitations, empty groups, and connection errors. Match analysis stories cover populated and empty replays and balance summaries. The mobile browser interaction check saves claims and notes, reloads them, clears them, and checks they stay cleared after reload. Standalone mobile story files register through the capture manifest, whose validator checks exports per source file.

Native device checks remain necessary for secure storage behavior and keyboard handling because Expo web cannot exercise those native APIs.

## Spectators and eliminated players

Spectators receive public match information and a separate observer chat shared with eliminated players. Alive players and alive bot contexts do not receive that channel. Observers cannot vote, visit, whisper, or control rematch readiness. Roles follow the normal public death and endgame reveal rules; public vote totals follow the lobby's vote visibility setting.

A room accepts at most 50 observers. PartyServer preserves observer identity during its existing 30-second reconnect grace period. Observer snapshots contain no private role or action permissions.

## Parties and invitations

PostgreSQL stores party membership, leadership, the suggested lobby destination, and invitations. An account belongs to one party, with at most 15 members. Invitations are friends-only and expire after 30 minutes. Acceptance rechecks invitation preferences and blocks in either direction, including blocks involving existing party members.

The leader invites, removes members, transfers leadership, and suggests a destination. Leaving leadership passes to the oldest remaining member. Empty parties are deleted; leadership changes invalidate pending invitations. Following a destination opens its lobby and never forces a player out of an active match. Migration `0006_fast_doorman` adds the persistence tables.

## Bot difficulty and evaluation

`shared/game/botProfiles.json` defines numeric difficulty and personality policies. The local runner enforces evidence references and minimum confidence for day votes and labelled deductions. Stable turn hashes apply the configured allowances for labelled accusations and bluffs. The policies vary by difficulty and personality while preserving the selected model.

Run the deterministic evaluation with `node tools/ai-bots/evaluation/run.mjs`. Optional `--live` evaluation makes 24 model calls using `gpt-6-luna`; it is separate from normal offline checks. Results distinguish supported evidence from a correct target. Evidence references do not guarantee semantic truth, calibrated model confidence, or detection of unlabelled deceptive prose.

Separate-character mode enforces private view isolation. Shared mode intentionally combines bot views and relies on instructions to preserve each character's knowledge when choosing actions.

Spectator visual stories cover watching and eliminated states, including the separate observer transcript and publicly visible roles. Web feature captures run across ten viewport, theme, and direction projects, with a full accessibility scan on desktop. Native-web captures run across six viewport and theme projects.

## ChatGPT platform coverage

Next.js browser AI setup is intentionally disabled with visible recovery copy; the published local flow requires an on-device callback listener. The Electron wrapper enables the shared Next.js setup through an isolated IPC bridge. React Native includes native loopback callback/signature modules, SecureStore credentials, on-device Responses streaming and the shared bot engine. The standalone Node companion remains diagnostic tooling and is no longer started by `dev:local`.

Coverage: browser-unavailable and native states in Storybook, native bridge/authorization and runtime tests, desktop controller/storage tests, Electron smoke, Android module compilation and platform bundling. iOS compilation/device acceptance and live account authorization/AI matches must be completed on release hardware. Keep mobile foregrounded while AI characters play; pause decision submission while backgrounded. This intentional browser/platform difference is exercised by `nextjs/.storybook/ai-characters.spec.ts`.
