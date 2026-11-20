# Admin game review

The Admin screen on web and mobile lists registered lobbies (including link-only
rooms) and quick-join rooms. Use a room ID for an exact lookup, page through recent
rooms, and Refresh to request a new snapshot. Counts and phase are point-in-time
values, with a checked time shown above the list. Each page probes at most eleven
rooms with four requests in flight and a three-second timeout per request.

Access uses the shared `admin.games` tRPC procedure and the existing active-account
identity check for browser sessions and mobile bearer tokens. Either the legacy
admin flag or the administrator role authorizes access. Responses explicitly
whitelist operational fields and the public player roster; roles, private chat, actions, and provider credentials
are excluded. This view does not join a room or consume a player/spectator seat.

Apply database migration `0008_admin_game_rooms` before deploying the Next.js
changes (`pnpm --dir nextjs db:migrate`). It seeds the current quick-join room and
retains old room IDs transactionally when quick join rotates. Earlier quick-join
rooms that were already discarded before this migration cannot be recovered from
the active-room directory. Custom lobbies remain discoverable through their
existing registration records. No migration has been applied by this change.

The game Worker adds public phase/day fields to its authenticated snapshot. Deploy
it before the clients to show phase details; older Workers remain readable with
phase shown as unavailable. No game mutations, private-content inspection, pause,
kick, or room termination controls are added in this pass.

Coverage includes shared authorization and request-lifecycle tests, snapshot
validation/privacy tests, a server phase snapshot test, web Storybook interactions,
and matching native story fixtures and screenshot coverage.
