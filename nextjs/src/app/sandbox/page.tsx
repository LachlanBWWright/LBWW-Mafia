import { Header } from "~/components/header";
import { RoleSandbox } from "./role-sandbox";
export default function SandboxPage() {
  return (
    <div className="bg-background min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <h1 className="text-3xl font-semibold">Role sandbox</h1>
        <RoleSandbox />
      </main>
    </div>
  );
}
