import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-[5rem]">
            Create <span className="text-[hsl(280,100%,70%)]">T3</span> App
          </h1>
          <div className="mt-4 flex justify-center gap-2">
            <Badge variant="secondary">Next.js 15</Badge>
            <Badge variant="secondary">ShadCN/UI</Badge>
            <Badge variant="secondary">Tailwind CSS</Badge>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
          <Card className="max-w-xs bg-white/10 border-white/20 hover:bg-white/20 transition-colors">
            <CardHeader>
              <CardTitle className="text-white">First Steps →</CardTitle>
              <CardDescription className="text-white/80">
                Just the basics - Everything you need to know to set up your
                database and authentication.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button variant="outline" className="w-full" asChild>
                <Link
                  href="https://create.t3.gg/en/usage/first-steps"
                  target="_blank"
                >
                  Get Started
                </Link>
              </Button>
            </CardContent>
          </Card>
          
          <Card className="max-w-xs bg-white/10 border-white/20 hover:bg-white/20 transition-colors">
            <CardHeader>
              <CardTitle className="text-white">Documentation →</CardTitle>
              <CardDescription className="text-white/80">
                Learn more about Create T3 App, the libraries it uses, and how to
                deploy it.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button variant="outline" className="w-full" asChild>
                <Link
                  href="https://create.t3.gg/en/introduction"
                  target="_blank"
                >
                  Learn More
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="w-full max-w-md bg-white/10 border-white/20">
          <CardHeader>
            <CardTitle className="text-white">ShadCN Components Demo</CardTitle>
            <CardDescription className="text-white/80">
              Example showing ShadCN/UI components in action
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="demo-input" className="text-sm font-medium text-white">
                Demo Input
              </label>
              <Input
                id="demo-input"
                placeholder="Type something..."
                className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary">
                Secondary
              </Button>
              <Button size="sm" variant="outline">
                Outline
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
