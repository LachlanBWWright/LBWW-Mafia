/** A clearly labelled illustration, shared by both landing screens. */
export const landingExample = {
  title: "Example discussion",
  phase: "Day 2",
  description: "Find the Mafia. Make your case. Decide who to trust.",
  messages: [
    {
      name: "Mira",
      body: "Theo, why did you change your vote at the last second?",
    },
    {
      name: "Theo",
      body: "I wanted to hear Jules's answer before the day ended.",
    },
    { name: "Jules", body: "Then let's hear it now. Who do you suspect?" },
  ],
  vote: "Mira voted for Theo.",
  prompt: "An alibi or a bluff? Your vote could decide the day.",
} as const;
