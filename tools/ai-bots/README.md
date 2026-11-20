# AI character runtimes

The Next.js browser client disables AI setup with an explanation. Electron and installed React Native apps handle **Continue with ChatGPT** directly, without a separate companion process, pasted keys or API billing fallback.

## API provider foundation

API-backed bots have a separate trusted-runtime entry point. They reuse the same player-scoped snapshots, character histories, personalities, difficulty policies, legal-action validation, signed bot-seat tickets, and stale-phase protection as subscription-backed bots. No API credentials are sent to the game server or either client, and no provider is selected automatically.

### Provider-neutral interface

The bot host depends on `TextGenerationProvider` from `shared/ai/generation.d.mts`:

```ts
type TextGenerationProvider = {
  readonly id: string;
  readonly model: string;
  generate(input: GenerateInput): Promise<string>;
  close?(): void;
  retry?(): void;
};
```

`GenerateInput` contains the model, instructions, text input/conversation, and optional cancellation signal. `generate` must return completed text only; it must reject failures, refusals, and truncated output with credential-safe errors. All generated actions still pass through the existing game validator. A provider owns authentication and generation. Shared admission controls apply independently of its transport. There is no closed provider-ID enum and no requirement for HTTP, an API key, or API billing at this interface.

`createProviderBotRuntime(provider, ports)` in `tools/ai-bots/provider-runtime.mjs` accepts that interface directly:

```js
const provider = {
  id: "my-provider",
  model: selectedModel,
  async generate(input) {
    return myTrustedInferenceClient.generate(input);
  },
  close() { myTrustedInferenceClient.close(); },
};
const runtime = createProviderBotRuntime(provider);
runtime.startBotSeats(seatOptions);
```

The trusted inference client in this example adapts the chosen SDK, local model, subscription runtime, or other backend to `GenerateInput`. No bot engine changes or registry entry are required. The host preserves method binding (including class instances), forwards cancellation even when `close()` is omitted, and calls optional provider cleanup once. Custom implementations must honor `input.signal` and the requested `input.maxOutputTokens` cap when supported by their backend. The provider instance belongs to this runtime; create another instance for another independently managed host.

`shared/ai/generationLimits.mjs` supplies `withProviderLimits(provider, limits)` and `createGenerationLimiter(generate, limits)` for every transport. Both the neutral host and the shared desktop/native bot runner apply that policy automatically. Already-managed HTTP providers reuse their limiter, so budgets and queues are not accidentally counted twice. Defaults are 2 concurrent requests, 24 queued requests, a 30-second deadline including queue time, 100 generation attempts, and a 2048-token requested output cap. Set `ports.limits` on `createProviderBotRuntime` or `limits` on `createBotRunner` to configure an SDK/local/subscription host. HTTP hosts use the same fields in provider configuration. Limits are per provider/runner and shared across its seat groups.

Cancellation rejects promptly even if an adapter settles late; the adapter must cooperate with the signal to stop backend work. Cancelled/obsolete output is never added to character history or submitted as an action. Explicit `runtime.retry()` clears paused policy/backend state and schedules eligible decisions for the current phase; it does not replenish the request budget.

### HTTP adapters

For HTTP/JSON providers, `createApiProvider(config, { registry, request, onUsage })` supplies shared request budgets, bounded concurrency/queueing, timeouts, cancellation, endpoint protections, HTTP error handling, response-size limits, and usage reporting. Each adapter implements only its vendor configuration and wire format:

```js
const adapter = {
  id: "my-provider",
  apiKeyEnv: "MY_PROVIDER_TOKEN", // Omit for providers without an API key.
  create(config) {
    return {
      url: "https://provider.example/generate",
      headers: { "X-Provider-Token": config.apiKey },
      encode({ model, instructions, messages, maxOutputTokens }) {
        return { model, instructions, conversation: messages, limit: maxOutputTokens };
      },
      decode(body) {
        if (body.completed !== true || typeof body.text !== "string")
          throw new ProviderError("incomplete", "Provider did not complete.");
        return body.text;
      },
      usage(body) {
        return { inputTokens: body.tokens?.input, outputTokens: body.tokens?.output };
      },
    };
  },
};
const registry = createProviderRegistry([...builtinApiAdapters, adapter]);
const provider = createApiProvider(config, { registry });
const runtime = createProviderBotRuntime(provider);
```

Import `createApiProvider`, `createProviderRegistry`, and `builtinApiAdapters` from `shared/ai/provider.mjs`, `ProviderError` from `shared/ai/providerError.mjs`, and the bot host from `tools/ai-bots/provider-runtime.mjs`. `HttpProviderAdapter` documents this interface in `shared/ai/provider.d.mts`. `create` owns credential validation; adapter-specific configuration can live in `config.options` or a trusted factory closure. `usage` is optional. `decode` owns recognizing completion, refusal, and truncation for its wire format, and must reject tool calls or unsupported output rather than treating them as text.

Registries are isolated to their host. Duplicate IDs fail instead of silently replacing an adapter. Adding a provider consists of one adapter and registration at the host's composition point; no edits to the transport policy, environment parser, game runner, or clients are needed. An embedding Node entry point can call `runApiBots(file, { registry })` from `tools/ai-bots/api/run.mjs`; its environment parser reads the selected adapter's optional `apiKeyEnv` rather than branching on provider names.

The supplied adapters under `shared/ai/adapters/` implement exactly this interface:

- `openai`: OpenAI Responses at the fixed official endpoint, with `store: false`.
- `anthropic`: Anthropic Messages at the fixed official endpoint, pinned to API version `2023-06-01`.
- `openai-compatible`: Chat Completions at an explicitly configured base URL. Supply the API root, including `/v1` if required; the adapter appends `/chat/completions`.

All HTTP adapters require HTTPS except for loopback HTTP. Redirects and credentials in URLs are rejected. `onUsage` receives available input/output token counts, including HTTP responses rejected as incomplete decisions; missing counts are `null`. This is token accounting, not a price estimate. Usage collection cannot discard a successful decision.

`createApiBotRuntime(config, ports)` remains a convenience composition of the HTTP provider and neutral bot host. Both hosts support `startBotSeats(options)`, `setPaused(boolean)`, `retry()`, and `close()`. Closing the runtime closes its sockets and cancels active/queued requests. Stopping one seat group closes that group's sockets and cancels its active/queued decisions without closing other groups. Phase changes, death, disconnects, and app pauses cancel obsolete requests. In shared mode an obsolete member cancels the combined request; surviving seats can receive a fresh request. In per-character mode only the affected seat is cancelled.

### Explicit Node host

Configure these variables in the trusted host environment:

| Variable | Purpose / default |
| --- | --- |
| `MAFIA_AI_PROVIDER` | Required registered adapter ID; the bundled CLI includes `openai`, `anthropic`, and `openai-compatible` |
| `MAFIA_AI_MODEL` | Required exact model ID; no model defaults or substitutions |
| `OPENAI_API_KEY` | Required for `openai` |
| `ANTHROPIC_API_KEY` | Required for `anthropic` |
| `MAFIA_AI_API_KEY` | Required for `openai-compatible` |
| `MAFIA_AI_BASE_URL` | Required only for `openai-compatible` |
| `MAFIA_AI_MAX_OUTPUT_TOKENS` | Maximum output tokens per request; default `2048` |
| `MAFIA_AI_TIMEOUT_MS` | Request deadline, including queue time; default `30000` |
| `MAFIA_AI_MAX_CONCURRENT_REQUESTS` | Maximum concurrent requests; default `2` |
| `MAFIA_AI_MAX_QUEUED_REQUESTS` | Maximum waiting requests; default `24` |
| `MAFIA_AI_MAX_REQUESTS` | Maximum attempted requests for this runtime; default `100` |

The attempt budget includes failed generation attempts and is shared by all seat groups in one runtime. Cancelled queued requests do not consume an attempt. It is not a dollar budget. No automatic retries or billing-source fallback are performed. Authentication and rate-limit failures pause further requests. A host using the provider directly can call `retry()` after checking the cause; this does not replenish the attempt budget. The Node bot runtime also exposes `retry()`; restarting creates a new budget. Desktop and native subscription retries resume the same phase without silently resetting that budget.

Launch using an options file on the trusted host:

```sh
pnpm run ai-bots -- api-run /secure/path/seat-options.json
```

The file contains game connection options, not provider credentials:

```json
{
  "url": "https://your-game-server.example",
  "room": "your-room-id",
  "tickets": ["fresh-signed-bot-seat-ticket"],
  "captcha": "",
  "mode": "per-character",
  "personality": "varied",
  "difficulty": "standard"
}
```

Obtain fresh tickets through the existing `POST /api/account/game-ticket` flow (`{ "count": 1 }` returns `{ "tokens": [...] }`); tickets currently expire after 60 seconds. Supply the applicable Turnstile token when the server requires one. The host does not mint tickets, bypass room authorization, or start a paid request just by loading configuration. Use normal lobby controls to start the game. `shared` mode combines the supplied seats' views in one request; `per-character` keeps their prompts and histories separate. Ctrl+C/SIGTERM closes sockets and cancels requests.

### Remaining product integration (web and mobile)

This is runtime infrastructure, not a new player-facing provider picker. Both clients retain their existing subscription setup. Follow-up work must ship together on web and React Native:

- Define an authenticated hosted bot-session API with room ownership checks, deployment-managed provider credentials, per-account quotas and spend controls, and durable usage/session lifecycle handling.
- Add shared provider/model availability and session-status contracts without embedding credentials in responses, lobby state, telemetry, or client bundles. Let players explicitly choose their inference source and applicable billing, using provider metadata rather than hardcoded vendor branches.
- Connect both lobby setup panels to that session API, including cancellation, paused-limit recovery, and disconnect behavior. A browser must never instantiate the API adapter with a secret key.
- Add provider-selection/session parity tests and corresponding Storybook/visual coverage on both clients before enabling API setup in the product.

Offline checks: `pnpm run test:ai-api`. These exercise provider wire formats, error handling, budgets, cancellation, isolated character prompts, and the real signed-seat runner with mocked HTTP/WebSockets. No paid requests run during tests. Live provider credentials, model access, and an end-to-end paid match still need deployment verification.

Provider contracts were checked against [OpenAI text generation](https://developers.openai.com/api/docs/guides/text), [Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create), [Anthropic Messages](https://platform.claude.com/docs/en/api/messages/create), and [Anthropic API versions](https://platform.claude.com/docs/en/api/versioning).

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
- `per-character` makes separate model requests with each character's own snapshot, observations, and rolling conversation history. Valid decisions are submitted as soon as they complete. A failed or malformed decision is reported for that character and cannot suppress successful peers. Only successful, current decisions enter history.

Each character entry must contain its player-scoped `snapshot`, that player's `observations`, private conversation history, and a socket implementing the game's `emit` interface. The caller must collect observations from that character's own socket only. Do not pass the server's full room state. Each isolated history retains up to twelve decision turns; shared mode retains one combined history for the supplied characters.

The module validates generated actions against each player-scoped snapshot before sending them through normal game socket actions. The shared runner supplies each seat only its own received snapshots and observations; shared mode places all supplied player views into one request, while per-character mode keeps them separate.

The lobby also offers Cautious, Argumentative, and Deceptive personalities, plus a Varied batch that cycles through those personalities. Difficulty can be Casual, Standard, or Challenging. These settings include numeric behavior policies as well as instructions; they do not select another model or guarantee a particular skill level. The chosen personality and difficulty remain assigned to that seat across rounds.

After a match ends, bots automatically ready for the next round. The runner clears their conversation memory when the new match identifier arrives, preserving the seat's personality and difficulty. It skips decisions for eliminated characters and finished matches, and discards generated actions if the snapshot has advanced before the response arrives.

Bots decide once when a new game snapshot or phase version arrives. Incoming chat and whisper messages also trigger a reaction decision after `CHAT_REACT_DEBOUNCE` (5 seconds); new messages during that window reset the timer so a burst of chat produces one model call batch. The chat-triggered decision uses the normal context mode and includes the messages each bot received.

## Platform coverage

Electron and React Native run bot sockets locally and obtain signed bot-seat tickets from the game API. ChatGPT connection is independent of the game account; guest seats do not require Google sign-in. The browser intentionally cannot add ChatGPT AI seats.

Bot messages appear alongside other game chat messages.

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
