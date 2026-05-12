import "~/styles/globals.css";

import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "LBWW Mafia - Online Multiplayer Mafia Game",
  description:
    "Play Mafia online with friends in real-time. A multiplayer social deduction game.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="dark">{children}</body>
    </html>
  );
}
