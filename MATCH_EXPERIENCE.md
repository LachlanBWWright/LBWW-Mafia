# Match experience

Web and mobile use the shared lobby reducer, action rules, practice transport, role catalogue, and Storybook fixtures.

- Game snapshots confirm submitted visits and votes. Night visits can be changed or cancelled before resolution; votes remain final once cast. Abstention is an explicit day vote.
- Public vote lobbies show totals, targets, and pending/abstained/voted states. Hidden vote lobbies omit all three fields and public vote announcements. Only a player's own selection is returned privately.
- Private action results remain private. A resolved action does not promise a successful effect or reveal whether a target was attacked; investigations and other observable results appear in private messages.
- Reconnection restores the current choice, role permissions, timer, and public phase/death timeline. Presence is visible while PartyServer retains disconnected seats for its existing 30-second grace period.
- Ended matches reveal roles and retain the room. All participants must be connected and ready before the same group starts a new round. Each round has a new match identifier, and bots reset their memories and automatically ready for a rematch.
- Practice uses a deterministic three-player local scenario. It teaches protection, discussion, voting, and the recap without a server or model request. Its dialogue and outcomes are scripted rather than a full simulation of game rules.
- Bot personality and difficulty are fixed for each seat. Varied batches cycle through cautious, argumentative, and deceptive personalities. Difficulty changes the decision instructions, not the selected model. Separate contexts retain their existing isolation.
- Muting bots hides bot chat locally, while preserving system announcements. The web respects reduced-motion CSS preferences; native phase transitions respect the OS reduced-motion setting. Native action haptics are optional and off by default.

## Coverage and release checks

Shared fixtures in `shared/testing/matchFixtures.ts` drive visual stories for selected night actions, public voting, hidden votes, reconnection, and recap on both platforms. Both catalogs also expose the interactive local practice flow. The stories use the same rendering components as the live lobby, while the shared practice transport exercises the normal lobby reducer and action events.

`shared/game/matchExperience.test.ts` covers vote visibility, bot chat muting, reconnection summaries, private action feedback, round resets, and the practice action/vote/replay flow. `server/model/rooms/room.experience.test.ts` covers live room privacy, vote metadata, action changes and cancellation, and rematches. Bot runtime tests cover profile validation, context scope, response validation, and rematch memory resets.

Native keyboard avoidance and haptics still need iOS and Android device checks because the Expo web visual export cannot exercise those native behaviors. Haptics are intentionally native-only and off by default; the web confirms actions through visible feedback and accessible status messages.
