import { Header } from "~/components/header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <div className="container mx-auto flex-1 px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              About <span className="text-primary">MERN Mafia</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              A modern take on the classic social deduction game
            </p>
          </div>

          {/* Project Info */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-2xl">The Project</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                MERN Mafia is an online multiplayer implementation of the classic Mafia social
                deduction game. Built with modern web technologies, it allows players from around
                the world to connect and play together in real-time.
              </p>
              <p className="text-muted-foreground">
                The game features multiple roles with unique abilities, day/night cycles, and
                strategic gameplay that tests your deduction skills and ability to read others.
              </p>
            </CardContent>
          </Card>

          {/* Features */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    ✓
                  </div>
                  <div>
                    <h4 className="font-semibold">Real-Time Multiplayer</h4>
                    <p className="text-sm text-muted-foreground">
                      WebSocket-based gameplay with instant updates
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    ✓
                  </div>
                  <div>
                    <h4 className="font-semibold">Multiple Game Modes</h4>
                    <p className="text-sm text-muted-foreground">
                      Public matchmaking and private rooms
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    ✓
                  </div>
                  <div>
                    <h4 className="font-semibold">Diverse Role System</h4>
                    <p className="text-sm text-muted-foreground">
                      Town, Mafia, and Neutral roles with unique abilities
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    ✓
                  </div>
                  <div>
                    <h4 className="font-semibold">Responsive Design</h4>
                    <p className="text-sm text-muted-foreground">
                      Play on desktop, tablet, or mobile devices
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
