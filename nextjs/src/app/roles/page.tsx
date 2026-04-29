import { Header } from "~/components/header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  roleSections,
  type RoleCatalogEntry,
} from "@mernmafia/shared/game/roles";

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
    <section className="mb-12">
      <h2 className="mb-6 text-3xl font-bold">
        <span className={accentClass}>{title}</span> Roles
      </h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => (
          <Card key={role.name} className="border-primary/20">
            <CardHeader>
              <CardTitle>{role.name}</CardTitle>
              <CardDescription>{role.category}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{role.summary}</CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export default function RolesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <div className="container mx-auto flex-1 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Game <span className="text-primary">Roles</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Reference of active roles used by the server role handler.
            </p>
          </div>

          {roleSections.map((section) => {
            const accentClass =
              section.faction === "town"
                ? "text-primary"
                : section.faction === "mafia"
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
      </div>
    </div>
  );
}
