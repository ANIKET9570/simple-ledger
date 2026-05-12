import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, BookOpen, Users, Check } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ledgr — Simple ledger for small businesses" },
      {
        name: "description",
        content:
          "Track income, expenses, customers and vendors. A clean, fast ledger built for small teams.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              L
            </span>
            <span>Ledgr</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link to="/login" className="text-muted-foreground hover:text-foreground transition">
              Sign in
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:opacity-90 transition font-medium"
            >
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6">
        {/* Hero Section */}
        <section className="py-20 md:py-32">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5 text-xs font-medium text-secondary-foreground">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Perfect for startups and small teams
            </div>
            <h1 className="mt-8 text-6xl md:text-7xl font-bold tracking-tight leading-tight">
              The ledger built for <span className="text-primary">growing</span> businesses
            </h1>
            <p className="mt-6 text-xl text-muted-foreground max-w-2xl leading-relaxed">
              Stop juggling spreadsheets. Track income, expenses, and manage customers all in one beautiful dashboard. Free forever for small teams.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-primary-foreground hover:opacity-90 transition font-semibold text-base"
              >
                Start free <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center rounded-lg border border-border/50 bg-background px-6 py-3 hover:bg-secondary transition font-semibold text-base"
              >
                View demo
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 py-20">
          {[
            { icon: BookOpen, title: "Income & Expenses", desc: "Log transactions in seconds with smart categorization" },
            { icon: Users, title: "Contacts Management", desc: "Organize customers, vendors, and team members" },
            { icon: BarChart3, title: "Live Dashboard", desc: "Real-time insights into your cash flow and profit" },
            { icon: Check, title: "Smart Reports", desc: "Export and analyze your financial data" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-border/50 bg-card p-8 hover:border-primary/50 transition">
              <Icon className="h-5 w-5 text-muted-foreground" />
              <h3 className="mt-4 font-medium">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </section>

        <footer className="border-t border-border/50 py-12 mt-12">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-primary text-primary-foreground text-xs font-bold">L</span>
              Ledgr
            </Link>
            <p className="mt-4 md:mt-0 text-sm text-muted-foreground">© {new Date().getFullYear()} Ledgr. All rights reserved.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
