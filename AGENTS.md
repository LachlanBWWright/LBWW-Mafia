# Repository guidance for agents

## Product UI

- Do not overuse cards. A card should represent a meaningful grouped surface or distinct interaction area, not wrap every block of content by default. Prefer spacing, typography, separators, and the page layout when they communicate hierarchy clearly.
- Do not overuse badges. Reserve badges for compact status, category, count, or state information that users need to scan. Do not use them as decorative labels, section headings, slogans, or substitutes for ordinary text.
- Do not put agent commentary, implementation notes, migration status, parity claims, data-source details, or explanations aimed at the person running the agent into the product UI.
- Do not explain obvious interface behavior in the interface. Copy should help the product's end user make a decision or recover from uncertainty; omit text that merely narrates visible controls.
- Keep developer-facing limitations and verification notes in documentation, tests, commit messages, or the agent's handoff unless an end user genuinely needs the information to use the product safely.

## Web and mobile parity

- Treat the Next.js web client and React Native client as one product: new user-facing features must be implemented or explicitly tracked on both platforms.
- Keep navigation destinations, authentication gates, terminology, game actions, messaging, community relationships, presence indicators, and lobby creation behavior aligned across both clients.
- Prefer shared contracts, validation, event reducers, navigation metadata, design tokens, and fixtures for behavior; keep platform-specific code limited to rendering and native/web transport concerns.
- When a feature is intentionally platform-specific, document the reason and add a parity test or follow-up task so the difference is visible.
- Before considering a feature complete, run the relevant web and mobile typechecks/tests and verify the corresponding Storybook or visual-test coverage.
