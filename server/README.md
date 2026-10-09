# Game server

The production host is PartyKit. Each room owns its game engine and validated
lobby rules. Socket.IO and Supabase remain compatibility transports.

Run the full local game from the repository root with `pnpm run dev`.
For deployment and required PartyKit variables see [DEPLOYMENT.md](../DEPLOYMENT.md).
For reconnect behavior and tests see [RELIABILITY.md](../RELIABILITY.md).

```bash
pnpm --dir server run typecheck
pnpm --dir server run test
pnpm --dir server run test:coverage
```
