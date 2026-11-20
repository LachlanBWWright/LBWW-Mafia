"use client";
import { useEffect, useState } from "react";
import type { CampaignSummary } from "@mernmafia/shared/trpc/gameCommunity";
import {
  campaignFailure,
  campaignHost,
  setupVoteCounts,
} from "@mernmafia/shared/game/campaignPresentation";
import { gameCommunityClient } from "./game-community-client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function PersistentLobbyDetail({
  lobby,
  busy,
  onRotate,
  onRound,
  onVote,
}: {
  lobby: CampaignSummary;
  busy: boolean;
  onRotate: () => void;
  onRound: (matchId: number) => void;
  onVote: (code: string) => void;
}) {
  const [matchId, setMatchId] = useState("");
  const [packCode, setPackCode] = useState("");
  return (
    <section className="space-y-5 border-t pt-6" aria-label={lobby.name}>
      <h2 className="text-2xl font-semibold">{lobby.name}</h2>
      <p>Current host: {campaignHost(lobby)}</p>
      <p className="text-sm">
        Invite code:{" "}
        <code className="break-all select-all">{lobby.shareCode}</code>
      </p>
      <h3 className="font-semibold">Players</h3>
      <ul>
        {lobby.members.map((member) => (
          <li key={member.userId}>
            {member.name ?? "Unnamed player"}
            {member.userId === lobby.hostId ? " · Host" : ""}
          </li>
        ))}
      </ul>
      {lobby.canManage ? (
        <Button disabled={busy} variant="outline" onClick={onRotate}>
          Rotate host
        </Button>
      ) : null}
      <h3 className="font-semibold">Scoreboard</h3>
      {lobby.scoreboard.length ? (
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th>Player</th>
              <th>Wins</th>
              <th>Draws</th>
              <th>Games</th>
            </tr>
          </thead>
          <tbody>
            {lobby.scoreboard.map((row) => (
              <tr key={row.userId}>
                <td>{row.name ?? "Unnamed player"}</td>
                <td>{row.wins}</td>
                <td>{row.draws}</td>
                <td>{row.games}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No completed rounds yet.</p>
      )}
      <p>
        {lobby.rounds.length} completed rounds
        {lobby.rounds.length
          ? `: ${lobby.rounds.map((round) => `#${round.matchId}`).join(", ")}`
          : ""}
      </p>
      {lobby.canManage ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onRound(Number(matchId));
          }}
        >
          <label className="space-y-1">
            Completed match number
            <Input
              type="number"
              min={1}
              step={1}
              required
              value={matchId}
              onChange={(event) => setMatchId(event.target.value)}
            />
          </label>
          <Button disabled={busy} type="submit">
            Add round
          </Button>
        </form>
      ) : null}
      <h3 className="font-semibold">Next setup vote</h3>
      <ul>
        {setupVoteCounts(lobby).map((vote) => (
          <li className="break-all" key={vote.packCode}>
            {vote.packCode} · {vote.votes} votes
          </li>
        ))}
      </ul>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          onVote(packCode.trim());
        }}
      >
        <label className="space-y-1">
          Shared game pack code
          <Input
            required
            value={packCode}
            onChange={(event) => setPackCode(event.target.value)}
          />
        </label>
        <Button disabled={busy} type="submit">
          Vote for setup
        </Button>
      </form>
    </section>
  );
}
export function Campaigns() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]),
    [selected, setSelected] = useState<CampaignSummary | null>(null);
  const [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void gameCommunityClient.community.list
      .query(undefined, { signal: controller.signal })
      .then(setCampaigns)
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(campaignFailure(failure));
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, []);
  async function act(operation: () => Promise<CampaignSummary>) {
    setBusy(true);
    setError("");
    try {
      const result = await operation();
      setSelected(result);
      setCampaigns((previous) => [
        result,
        ...previous.filter((item) => item.id !== result.id),
      ]);
    } catch (failure) {
      setError(campaignFailure(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-7">
      <p className="text-muted-foreground">
        Keep scores across a game night, rotate hosts, and choose the next setup
        together.
      </p>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          void act(() =>
            gameCommunityClient.community.create.mutate({ name: name.trim() }),
          );
        }}
      >
        <label>
          Lobby name
          <Input
            required
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <Button disabled={busy}>Create persistent lobby</Button>
      </form>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          void act(() =>
            gameCommunityClient.community.join.mutate({
              shareCode: code.trim(),
            }),
          );
        }}
      >
        <label>
          Invite code
          <Input
            required
            pattern="[a-f0-9]{32}"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        <Button disabled={busy} variant="outline">
          Join persistent lobby
        </Button>
      </form>
      {busy ? <p role="status">Loading persistent lobbies…</p> : null}
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Your persistent lobbies</h2>
        {!busy && !campaigns.length ? <p>No persistent lobbies yet.</p> : null}
        {campaigns.map((lobby) => (
          <Button
            key={lobby.id}
            variant="ghost"
            disabled={busy}
            onClick={() =>
              void act(() =>
                gameCommunityClient.community.detail.query({
                  campaignId: lobby.id,
                }),
              )
            }
          >
            {lobby.name}
          </Button>
        ))}
      </section>
      {selected ? (
        <PersistentLobbyDetail
          key={selected.id}
          lobby={selected}
          busy={busy}
          onRotate={() =>
            void act(() =>
              gameCommunityClient.community.rotateHost.mutate({
                campaignId: selected.id,
              }),
            )
          }
          onRound={(matchId) =>
            void act(() =>
              gameCommunityClient.community.addRound.mutate({
                campaignId: selected.id,
                matchId,
              }),
            )
          }
          onVote={(packCode) =>
            void act(() =>
              gameCommunityClient.community.voteSetup.mutate({
                campaignId: selected.id,
                packCode,
              }),
            )
          }
        />
      ) : null}
    </div>
  );
}
