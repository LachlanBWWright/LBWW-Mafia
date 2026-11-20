import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { allRoles } from "@mernmafia/shared/game/rolesList";
import { actionExamples, iconExampleNames } from "@mernmafia/shared/testing/iconFixtures";
import { avatarOptions } from "@mernmafia/shared/trpc/accountFeatures";
import { PlayerAvatar } from "~/components/player-avatar";
import { RoleIcon } from "~/components/role-icon";
import { ActionIcon } from "~/components/action-icon";

function IconCatalog() {
  return <main className="bg-background text-foreground mx-auto max-w-4xl space-y-8 p-6">
    <h1 className="text-2xl font-semibold">Game icon placeholders</h1>
    <section><h2 className="mb-3 text-lg font-semibold">Account avatars</h2><div className="flex flex-wrap gap-4">{avatarOptions.map((option) => <div key={option.id} className="flex items-center gap-2 text-sm"><PlayerAvatar name={option.name} preset={option.id} />{option.name}</div>)}</div></section>
    <section><h2 className="mb-3 text-lg font-semibold">Anonymous player portraits</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{iconExampleNames.map((name) => <div key={name} className="flex items-center gap-2"><PlayerAvatar name={name} anonymous /><span className="text-sm">{name}</span></div>)}</div></section>
    <section><h2 className="mb-3 text-lg font-semibold">Roles</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{allRoles.map((role) => <div key={role.name} className="flex items-center gap-2 text-sm"><RoleIcon role={role.name} />{role.name}</div>)}</div></section>
    <section><h2 className="mb-3 text-lg font-semibold">Actions</h2><div className="flex flex-wrap gap-4">{actionExamples.map(({ action, label }) => <div key={action} className="flex items-center gap-2 text-sm"><ActionIcon action={action} />{label}</div>)}</div></section>
  </main>;
}
const meta = { title: "Game/Icons", component: IconCatalog, parameters: { layout: "fullscreen" } } satisfies Meta<typeof IconCatalog>;
export default meta;
export const PlaceholderCatalog: StoryObj<typeof meta> = {};
