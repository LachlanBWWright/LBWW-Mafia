import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { MafSiteNavbar } from "./MafSiteNavbar";
import { TRPCProvider } from "~/components/TRPCProvider";
import { AuthProvider } from "~/components/AuthProvider";

export const metadata: Metadata = {
  title: "MERN Mafia",
  description: "Mern Mafia online game",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://maxcdn.bootstrapcdn.com/bootstrap/4.2.1/css/bootstrap.min.css"
          integrity="sha384-GJzZqFGwb1QTTN6wy59ffF1BuGJpLSa9DkKMp0DgiMDm4iYMj70gZWKYbI706tWS"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <AuthProvider>
          <TRPCProvider>
            <MafSiteNavbar>{children}</MafSiteNavbar>
          </TRPCProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
