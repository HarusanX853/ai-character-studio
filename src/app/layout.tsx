import type { Metadata } from "next";
import Link from "next/link";
import { Clapperboard, Coins, LayoutDashboard, UsersRound } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Character Studio",
  description: "A multi-agent character theater control console."
};

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/characters", label: "Characters", icon: UsersRound },
  { href: "/episodes", label: "Episodes", icon: Clapperboard },
  { href: "/cost-center", label: "Cost Center", icon: Coins }
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="flex min-h-screen">
          <aside className="hidden w-64 border-r bg-card px-4 py-5 md:block">
            <Link href="/dashboard" className="mb-8 flex items-center gap-2 text-lg font-semibold">
              <Clapperboard className="h-5 w-5 text-primary" />
              AI Character Studio
            </Link>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
          <main className="flex-1">
            <div className="border-b bg-card px-4 py-3 md:hidden">
              <div className="flex items-center justify-between">
                <Link href="/dashboard" className="font-semibold">
                  AI Character Studio
                </Link>
                <div className="flex gap-2">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link key={item.href} href={item.href} className="rounded-md border p-2">
                        <Icon className="h-4 w-4" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
