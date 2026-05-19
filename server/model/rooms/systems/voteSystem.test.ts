import { describe, expect, it } from "vitest";
import { createTestPlayer } from "../../testUtils/gameTestUtils.js";
import { resolveDayVote } from "./voteSystem.js";

describe("resolveDayVote", () => {
  it("returns no elimination when no living player reaches quorum", () => {
    const alpha = createTestPlayer("alpha");
    const beta = createTestPlayer("beta");
    alpha.votesReceived = 1;
    beta.votesReceived = 2;

    expect(resolveDayVote([alpha, beta], 3)).toEqual({
      kind: "no-elimination",
    });
  });

  it("returns the highest voted player when exactly one player leads above quorum", () => {
    const alpha = createTestPlayer("alpha");
    const beta = createTestPlayer("beta");
    const gamma = createTestPlayer("gamma");
    alpha.votesReceived = 2;
    beta.votesReceived = 4;
    gamma.votesReceived = 3;

    expect(resolveDayVote([alpha, beta, gamma], 2)).toEqual({
      kind: "eliminated",
      player: beta,
      votes: 4,
    });
  });

  it("returns tied leaders when multiple players share the highest quorum vote", () => {
    const alpha = createTestPlayer("alpha");
    const beta = createTestPlayer("beta");
    const gamma = createTestPlayer("gamma");
    alpha.votesReceived = 4;
    beta.votesReceived = 2;
    gamma.votesReceived = 4;

    expect(resolveDayVote([alpha, beta, gamma], 2)).toEqual({
      kind: "tie",
      candidates: [alpha, gamma],
      votes: 4,
    });
  });
});
