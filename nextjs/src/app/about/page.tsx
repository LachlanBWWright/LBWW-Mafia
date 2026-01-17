import { Header } from "~/components/header";
import { Footer } from "~/components/footer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";

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

          {/* Tech Stack */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-2xl">Technology Stack</CardTitle>
              <CardDescription>Built with modern, production-ready technologies</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="mb-3 font-semibold text-primary">Frontend</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="text-primary">•</span>
                      <span><strong>Next.js 15</strong> - React framework with App Router</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-primary">•</span>
                      <span><strong>React 19</strong> - Latest React with server components</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-primary">•</span>
                      <span><strong>Tailwind CSS v4</strong> - Utility-first styling</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-primary">•</span>
                      <span><strong>shadcn/ui</strong> - Beautiful, accessible components</span>
                    </li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="mb-3 font-semibold text-primary">Backend</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="text-primary">•</span>
                      <span><strong>Node.js</strong> - JavaScript runtime</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-primary">•</span>
                      <span><strong>Express</strong> - Web application framework</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-primary">•</span>
                      <span><strong>Socket.IO</strong> - Real-time bidirectional communication</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-primary">•</span>
                      <span><strong>MongoDB</strong> - NoSQL database</span>
                    </li>
                  </ul>
                </div>
              </div>

              <Separator className="my-6" />

              <div>
                <h3 className="mb-3 font-semibold text-primary">Database & Auth</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="text-primary">•</span>
                    <span><strong>Drizzle ORM</strong> - Type-safe database toolkit</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-primary">•</span>
                    <span><strong>SQLite/Turso</strong> - Lightweight, edge-ready database</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-primary">•</span>
                    <span><strong>NextAuth.js</strong> - Authentication for Next.js</span>
                  </li>
                </ul>
              </div>
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
      
      <Footer />
    </div>
  );
}
