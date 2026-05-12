import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, BookOpen, LogOut, Users } from "lucide-react";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;
  }

  const nav = [
    { to: "/app/dashboard", label: "Dashboard", icon: BarChart3 },
    { to: "/app/transactions", label: "Transactions", icon: BookOpen },
    { to: "/app/contacts", label: "Contacts", icon: Users },
  ] as const;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-60 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <Link to="/" className="flex h-14 items-center gap-2 px-5 font-semibold tracking-tight">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-primary text-primary-foreground text-xs">L</span>
          Ledgr
        </Link>
        <nav className="flex-1 space-y-0.5 px-3">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <div className="mb-2 truncate px-3 text-xs text-muted-foreground">{user.email}</div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/login" });
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent/60"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex w-full flex-col">
        <header className="flex h-14 items-center gap-2 border-b px-4 md:hidden">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-primary text-primary-foreground text-xs">L</span>
            Ledgr
          </Link>
          <nav className="ml-auto flex gap-1 text-sm">
            {nav.map(({ to, label }) => (
              <Link key={to} to={to} className="rounded-md px-2 py-1 hover:bg-accent">
                {label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
