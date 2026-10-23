import { Header } from "~/components/header";
import { LandingContent } from "~/components/landing-content";

export default function HomePage() {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-12">
        <LandingContent />
      </main>
    </div>
  );
}
