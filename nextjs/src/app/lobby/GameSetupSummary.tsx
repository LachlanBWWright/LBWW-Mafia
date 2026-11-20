"use client";
import type { GameSnapshot } from "@mernmafia/shared/communication/events";
import { publicSetupLines } from "@mernmafia/shared/game/gameSetupPresentation";

export function GameSetupSummary({
  setup,
  started,
}: {
  setup?: GameSnapshot["setup"];
  started?: boolean;
}) {
  if (!setup) return null;
  return (
    <details
      open={!started}
      className="max-h-44 overflow-auto border-b py-2 text-sm"
    >
      <summary className="cursor-pointer font-medium">Game setup</summary>
      <ul className="text-muted-foreground space-y-1 py-2">
        {publicSetupLines(setup).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </details>
  );
}
