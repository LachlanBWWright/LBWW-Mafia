import { Header } from "~/components/header";

export default function CreateLobbyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="bg-background min-h-screen">
      <Header />
      {children}
    </div>
  );
}
