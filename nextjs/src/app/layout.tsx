import "~/styles/globals.css";

import { type Metadata } from "next";
import { auth } from "~/server/auth";
import { PresenceHeartbeat } from "~/components/presence-heartbeat";

export const metadata: Metadata = {
  title: "LBWW Mafia - Online Multiplayer Mafia Game",
  description:
    "Play Mafia online with friends in real-time. A multiplayer social deduction game.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="dark">
        <PresenceHeartbeat enabled={Boolean(session?.user)} />
        {children}
      </body>
    </html>
  );
}
