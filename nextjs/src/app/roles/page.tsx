import { Header } from "~/components/header";
import { roleSections } from "@mernmafia/shared/game/rolesList";
import { RoleFaction } from "@mernmafia/shared/game/rolesTypes";
import type { RoleCatalogEntry } from "@mernmafia/shared/game/rolesTypes";
import { RoleIcon } from "~/components/role-icon";

function RoleSection({
  title,
  accentClass,
  roles,
}: {
  title: string;
  accentClass: string;
  roles: readonly RoleCatalogEntry[];
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 text-xl font-semibold">
        <span className={accentClass}>{title}</span> Roles
      </h2>
      <ul className="border-t">
        {roles.map((role) => (
          <li key={role.name} className="grid gap-1 border-b py-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
            <div className="flex items-center gap-2"><RoleIcon role={role.name} /><span className="font-medium">{role.name}</span><span className="text-muted-foreground text-sm">{role.category}</span></div>
            <p className="text-muted-foreground text-sm">{role.summary}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function RolesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <div>
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">Game roles</h1>
          </div>

          {roleSections.map((section) => {
            const accentClass =
              section.faction === RoleFaction.Town
                ? "text-primary"
                : section.faction === RoleFaction.Mafia
                  ? "text-destructive"
                  : "text-muted-foreground";

            return (
              <RoleSection
                key={section.title}
                title={section.title}
                accentClass={accentClass}
                roles={section.roles}
              />
            );
          })}
        </div>
      </main>
    </div>
  );
}
