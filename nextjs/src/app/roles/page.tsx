import { Header } from "~/components/header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

type RoleEntry = {
  name: string;
  category: string;
  ability: string;
};

const townRoles: RoleEntry[] = [
  { name: "Doctor", category: "Town Protective", ability: "Protect a player from attacks." },
  { name: "Judge", category: "Town Investigative", ability: "Investigate alignments with uncertainty." },
  { name: "Watchman", category: "Town Investigative", ability: "See visitors to your target." },
  { name: "Investigator", category: "Town Investigative", ability: "Inspect faction clues at night." },
  { name: "Lawman", category: "Town Support", ability: "Coordinate with Lawman faction members." },
  { name: "Vetter", category: "Town Investigative", ability: "Vet two players to compare identities." },
  { name: "Tapper", category: "Town Support", ability: "Tap players to expose whispers/actions." },
  { name: "Tracker", category: "Town Investigative", ability: "Track who a target visits." },
  { name: "Bodyguard", category: "Town Protective", ability: "Guard a player and counter attackers." },
  { name: "Nimby", category: "Town Utility", ability: "Punish hostile visits to your target area." },
  { name: "Sacrificer", category: "Town Protective", ability: "Absorb damage for allies." },
  { name: "Fortifier", category: "Town Protective", ability: "Increase a target's defense." },
  { name: "Roleblocker", category: "Town Support", ability: "Prevent a player from acting." },
  { name: "Jailor", category: "Town Control", ability: "Jail and execute key suspects." },
];

const mafiaRoles: RoleEntry[] = [
  { name: "Mafia", category: "Mafia Killing", ability: "Perform faction attacks at night." },
  { name: "Mafia Roleblocker", category: "Mafia Support", ability: "Roleblock priority targets." },
  { name: "Mafia Investigator", category: "Mafia Investigative", ability: "Discover threat roles." },
];

const neutralRoles: RoleEntry[] = [
  { name: "Maniac", category: "Neutral Killing", ability: "Eliminate players for solo victory." },
  { name: "Sniper", category: "Neutral Killing", ability: "Take precision shots with constraints." },
  { name: "Framer", category: "Neutral Evil", ability: "Manipulate voting outcomes around targets." },
  { name: "Confesser", category: "Neutral Chaos", ability: "Win by being voted out." },
  { name: "Peacemaker", category: "Neutral Benign", ability: "Force a draw by prolonged peace." },
];

function RoleSection({
  title,
  accentClass,
  roles,
}: {
  title: string;
  accentClass: string;
  roles: RoleEntry[];
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
            <CardContent className="text-sm text-muted-foreground">
              {role.ability}
            </CardContent>
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

          <RoleSection title="Town" accentClass="text-primary" roles={townRoles} />
          <RoleSection title="Mafia" accentClass="text-destructive" roles={mafiaRoles} />
          <RoleSection title="Neutral" accentClass="text-muted-foreground" roles={neutralRoles} />
        </div>
      </div>
    </div>
  );
}
