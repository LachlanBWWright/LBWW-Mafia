import { Header } from "~/components/header";
import { PublicLobbies } from "./PublicLobbies";
export default function PublicLobbiesPage() {
  return (
    <div className="bg-background min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <PublicLobbies />
      </main>
    </div>
  );
}
