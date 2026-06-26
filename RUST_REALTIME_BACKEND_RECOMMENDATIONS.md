# Rust Realtime Backend Recommendations

## Recommended path

Use Rust for authoritative gameplay, keep the TypeScript implementation as the fallback oracle during migration, and attach transports as adapters around the shared protocol.

## Supabase Realtime

### Why it fits this repository now

- It matches the existing socket-agnostic contract well enough to relay room broadcasts and targeted callbacks.
- It removes the Rust-hosting mismatch that comes with PartyKit while still providing a managed realtime transport.
- It supports incremental rollout because the TypeScript server can remain the fallback path while Rust parity grows.

### Trade-offs

- Supabase Realtime is a relay, not an authoritative game runtime.
- Presence, reconnect handling, and replay capture still need explicit application logic.
- If the game eventually needs tighter control over latency and topology, a lower-level transport may fit better.

## Other Rust-friendly options

### NATS with a WebSocket gateway

- Best long-term fit when Rust is the authoritative runtime.
- Excellent Rust support and room fan-out flexibility.
- Higher infrastructure complexity than Supabase.

### Ably

- Strong managed transport abstraction and JavaScript client story.
- Good option when operational simplicity matters more than raw control.
- Rust integration is less direct than NATS.

### Self-hosted WebSockets

- Best if full control matters most.
- Pairs naturally with an axum/tokio Rust service.
- Highest operational burden for scaling and reliability.

## Recommendation summary

1. Replace the PartyKit migration path with Supabase Realtime first.
2. Keep evaluating NATS as the stronger long-term Rust-native messaging option.
3. Retire PartyKit once Socket.IO and Supabase-backed adapters cover the required client flows.
