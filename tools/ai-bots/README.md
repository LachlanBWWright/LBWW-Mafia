# ChatGPT AI characters

The Next.js browser client disables AI setup with an explanation. Electron and installed React Native apps handle **Continue with ChatGPT** directly, without a separate companion process, pasted keys or API billing fallback.

## Desktop

See [desktop setup](../../desktop/README.md). Electron main owns the OAuth callback, signed identity validation, serialized refresh, OS-protected encrypted credentials, streaming Responses and bot sockets. The preload exposes only status, sign-in, model metadata, disconnect/retry and validated bot-seat commands. It never exposes OAuth tokens or generic inference to the web renderer. Only the trusted main frame can invoke it.

## React Native

The `MafiaChatGPT` local Expo module binds an ephemeral `127.0.0.1` callback and verifies RSA signatures using the OS. iOS opens sign-in in a system Safari sheet; Android uses the system browser. Credentials remain in a separate device-only SecureStore record. Inference uses `expo/fetch` streaming and the shared portable runtime and bot engine. Rebuild the native app after adding the module; Expo Go and mobile web cannot use it. There is no computer address field or LAN pairing. See [mobile builds](../../mobile/README.md).

Keep the native app open while AI characters play. Decision submission pauses in the background. Disconnect closes bot groups, cancels pending inference and authorization, clears local tokens, and attempts remote revocation. Signing out retains the issued registration and stable host identifier for later authorization.

Both platforms use the account-specific model catalog and public Responses endpoint with `store: false` and `stream: true`. Only completed responses become decisions. Declined plan permission retains identity but blocks inference until explicitly enabled. HTTP and streamed usage-limit errors pause new requests until explicit retry. Tokens never go to Next.js, PartyServer, analytics or logs. These behaviors are shared rather than separately implemented for each platform.

## Diagnostic Node tools

`pnpm run ai-bots -- serve` remains an optional developer companion for diagnostics and existing tests. It is not a player setup requirement and is not started by the web launcher. `connect`, `status`, `models` and `ask <catalog-slug> <prompt>` remain available. The CLI uses a separate permissions-protected local file store, not the Electron keychain or mobile credentials. It never reads another application's credentials.

## Verification

Offline tests exercise callback state/client/nonce/signature checks, credential rotation, revocation races, plan permission, streaming limits, bot decisions, and desktop IPC boundaries. Electron packaging and Android export/module compilation are checked separately. A live account authorization and complete AI match must still be verified on each release target. iOS native compilation requires macOS/Xcode.

## Character decision modes

`characterDecisions.mjs` exports `runCharacterTurn({ mode, model, characters })`:

- `shared` makes one model request for all characters assigned to this runtime.
- `per-character` makes separate model requests with each character's own snapshot, observations, and rolling conversation history.

Each character entry must contain its player-scoped `snapshot`, that player's `observations`, private conversation history, and a socket implementing the game's `emit` interface. The caller must collect observations from that character's own socket only. Do not pass the server's full room state. Each isolated history retains up to twelve decision turns; shared mode retains one combined history for the supplied characters.

The module validates generated actions against each player-scoped snapshot before sending them through normal game socket actions. The shared runner supplies each seat only its own received snapshots and observations; shared mode places all supplied player views into one request, while per-character mode keeps them separate.

The lobby also offers Cautious, Argumentative, and Deceptive personalities, plus a Varied batch that cycles through those personalities. Difficulty can be Casual, Standard, or Challenging. These settings include numeric behavior policies as well as instructions; they do not select another model or guarantee a particular skill level. The chosen personality and difficulty remain assigned to that seat across rounds.

After a match ends, bots automatically ready for the next round. The runner clears their conversation memory when the new match identifier arrives, preserving the seat's personality and difficulty. It skips decisions for eliminated characters and finished matches, and discards generated actions if the snapshot has advanced before the response arrives.

Bots decide once when a new game snapshot or phase version arrives. Incoming chat and whisper messages also trigger a reaction decision after `CHAT_REACT_DEBOUNCE` (5 seconds); new messages during that window reset the timer so a burst of chat produces one model call batch. The chat-triggered decision uses the normal context mode and includes the messages each bot received.

## Platform coverage

Electron and React Native run bot sockets locally and obtain signed bot-seat tickets from the game API. ChatGPT connection is independent of the game account; guest seats do not require Google sign-in. The browser intentionally cannot add ChatGPT AI seats.

Both clients offer **Mute bots**, which hides bot chatter only on that client. System announcements remain visible, and muting does not remove messages from the characters' model context or stop their decisions.

## Difficulty policies and evaluation

The shared `shared/game/botProfiles.json` specifies evidence windows (12/40/80 observations), minimum confidence (45/60/75 percent), required evidence sources (1/1/2), aggression allowances (40/65/90 percent), and bluff allowances (5/20/40 percent) for Casual/Standard/Challenging. Cautious multiplies aggression by 0.8, Argumentative by 1.2, and Deceptive doubles the bluff allowance, capped at 100 percent. These are acceptance probabilities over stable turn hashes, not promised proportions within one match. A retry of the same turn does not reroll its allowance.

Each day vote and labeled observation/deduction needs distinct evidence IDs found in that character's supplied view and confidence above the configured threshold. Labeled bluffs and accusations also pass their numeric allowance. Ordinary questions and greetings are allowed. Role permissions, living targets, silence, and already submitted votes remain enforced independently. The runner retains at most 80 player-scoped observations across phases; difficulty limits how many are included on each turn. Conversations remember accepted decisions, avoiding rejected votes becoming fictitious prior actions.

Evidence ID validation establishes that the referenced source was available; it does not prove that the deduction follows from that source or that a player's claim is true. Confidence is a model estimate. Natural-language bluffs or accusations with missing labels cannot be detected reliably by this validator. Shared mode still combines character views in one model call and relies on the model to keep private knowledge separated; use per-character mode when strict context isolation matters.

Run the offline scripted evaluator from the repository root:

```sh
node tools/ai-bots/evaluation/run.mjs
```

This makes no model calls. It reports safety rejection, evidence-reference support, target accuracy against scripted expectations, aggression, and bluff acceptance across 200 deterministic samples per difficulty. The fixture with an incorrect deduction deliberately demonstrates that valid evidence references alone cannot establish reasoning accuracy. Expected targets stay in the evaluator and are never passed into character prompts.

An explicit live evaluation is available after connecting the local ChatGPT runtime:

```sh
node tools/ai-bots/evaluation/run.mjs --live gpt-6-luna
```

This uses the user's ChatGPT plan and requests one isolated decision per scenario and difficulty (24 calls for the current eight scenarios). It reports accepted decisions and expected target matches, after runtime filtering. It is not a raw model compliance benchmark or a statistically reliable skill ranking. No live evaluation runs during tests or normal offline evaluation.
