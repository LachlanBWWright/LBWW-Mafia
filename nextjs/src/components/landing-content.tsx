import Link from "next/link";
import { landingExample } from "@mernmafia/shared/game/landingExample";
import { Button } from "./ui/button";

export function LandingContent() {
  return (
    <div className="grid w-full items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
      <div className="space-y-6">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          LBWW Mafia
        </h1>
        <p className="text-muted-foreground max-w-lg text-lg leading-relaxed sm:text-xl">
          {landingExample.description}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" className="text-base" asChild>
            <Link href="/lobby">Join Game</Link>
          </Button>
          <Button size="lg" variant="outline" className="text-base" asChild>
            <Link href="/lobby/create">Create Lobby</Link>
          </Button>
        </div>
      </div>
      <section
        aria-labelledby="example-discussion"
        className="border-border border-y py-6"
      >
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <h2
            id="example-discussion"
            className="text-muted-foreground text-sm font-medium"
          >
            {landingExample.title}
          </h2>
          <p className="text-lg font-semibold">{landingExample.phase}</p>
        </div>
        <ol className="space-y-5" aria-label="Example chat">
          {landingExample.messages.map((message) => (
            <li
              key={message.name}
              className="grid grid-cols-[3rem_1fr] gap-3 text-sm leading-6 sm:text-base"
            >
              <span className="text-primary font-semibold">{message.name}</span>
              <p>{message.body}</p>
            </li>
          ))}
        </ol>
        <p className="border-border text-muted-foreground mt-6 border-t pt-4 text-sm">
          {landingExample.vote}
        </p>
        <p className="mt-3 text-sm font-medium">{landingExample.prompt}</p>
      </section>
    </div>
  );
}
