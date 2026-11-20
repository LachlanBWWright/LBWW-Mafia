import { Header } from "~/components/header";
import { LandingContent } from "~/components/landing-content";

export default function HomePage() {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <LandingContent />
      </main>
    </div>
  );
}
