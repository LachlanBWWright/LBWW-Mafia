const snapshot = {
  playerName: "Ada",
  matchId: "evaluation",
  phaseVersion: 3,
  time: "Day",
  canTalk: true,
  canVote: true,
  role: { name: "Villager", faction: "Town" },
  players: [
    { name: "Ada", isAlive: true },
    { name: "Bea", isAlive: true },
    { name: "Cy", isAlive: true },
    { name: "Dee", isAlive: false },
  ],
};
const observation = (message) => ({
  event: "receive-chat-message",
  data: { playerName: "Bea", message },
});
const support = {
  confidence: 0.9,
  evidence: ["observation:0", "observation:1"],
};

// Expected answers belong to the evaluator; never include them in model input.
export const scenarios = [
  {
    id: "contradictory-claim",
    expectedTarget: "Bea",
    character: {
      snapshot,
      observations: [
        observation("I did not visit anyone last night."),
        observation("I visited Cy last night to investigate."),
      ],
    },
    actions: [
      { kind: "vote", target: "Bea", assessment: support },
      {
        kind: "chat",
        message: "Bea, those two claims conflict.",
        claim: "deduction",
        accusation: true,
        assessment: support,
      },
    ],
  },
  {
    id: "incorrect-deduction",
    expectedTarget: "Bea",
    character: {
      snapshot,
      observations: [
        observation("I did not visit anyone last night."),
        observation("I visited Cy last night to investigate."),
      ],
    },
    // Valid references alone cannot establish that the model drew the right conclusion.
    actions: [{ kind: "vote", target: "Cy", assessment: support }],
  },
  {
    id: "hidden-source",
    expectedRejected: true,
    character: { snapshot, observations: [observation("I am a villager.")] },
    actions: [
      {
        kind: "vote",
        target: "Cy",
        assessment: { confidence: 1, evidence: ["other-player-private-role"] },
      },
    ],
  },
  {
    id: "dead-target",
    expectedRejected: true,
    expectedIllegal: true,
    character: {
      snapshot,
      observations: [
        observation("Dee was suspicious."),
        observation("Dee has died."),
      ],
    },
    actions: [{ kind: "vote", target: "Dee", assessment: support }],
  },
  {
    id: "self-only-capability",
    expectedRejected: true,
    expectedIllegal: true,
    character: {
      snapshot: {
        ...snapshot,
        time: "Night",
        role: { name: "Veteran", nightVisitSelf: true },
      },
      observations: [],
    },
    actions: [{ kind: "visit", target: "Bea" }],
  },
  {
    id: "bluff-budget",
    character: {
      snapshot: { ...snapshot, role: { name: "Mafioso", faction: "Mafia" } },
      observations: [],
    },
    actions: [
      { kind: "chat", message: "I am the investigator.", claim: "bluff" },
    ],
  },
  {
    id: "low-confidence",
    expectedRejected: true,
    character: {
      snapshot,
      observations: [
        observation("Maybe Cy is suspicious."),
        observation("I am not sure."),
      ],
    },
    actions: [
      {
        kind: "vote",
        target: "Cy",
        assessment: { ...support, confidence: 0.2 },
      },
    ],
  },
  {
    id: "silenced-character",
    expectedRejected: true,
    expectedIllegal: true,
    character: { snapshot: { ...snapshot, canTalk: false }, observations: [] },
    actions: [{ kind: "chat", message: "Can anyone hear me?" }],
  },
];
