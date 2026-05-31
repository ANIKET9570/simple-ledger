import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney } from "@/lib/format";
import { ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Ledgr" }] }),
  component: Dashboard,
});

type Tx = {
  id: string;
  type: "income" | "expense";
  amount: number;
  occurred_on: string;
  category: string;
  description: string | null;
};

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-tx"],
    queryFn: async () => {
      let allData: Tx[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const start = page * pageSize;
        const end = start + pageSize - 1;
        
        const { data, error } = await supabase
          .from("transactions")
          .select("id,type,amount,occurred_on,category,description")
          .order("occurred_on", { ascending: false })
          .range(start, end);
        
        if (error) throw error;
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allData = [...allData, ...data];
          hasMore = data.length === pageSize;
          page++;
        }
      }
      
      return allData as Tx[];
    },
  });

  const txs = data ?? [];
  const income = txs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = txs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const net = income - expense;

  // build last 30 days series
  const days: { date: string; income: number; expense: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, income: 0, expense: 0 });
  }
  txs.forEach((t) => {
    const day = days.find((d) => d.date === t.occurred_on);
    if (day) day[t.type] += Number(t.amount);
  });

  const stats = [
    { label: "Income", value: income, icon: ArrowUpRight, tone: "text-success" },
    { label: "Expenses", value: expense, icon: ArrowDownRight, tone: "text-destructive" },
    { label: "Net balance", value: net, icon: Wallet, tone: net >= 0 ? "text-success" : "text-destructive" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your business cash flow.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {label}
              <Icon className={`h-4 w-4 ${tone}`} />
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight">{fmtMoney(value)}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium">Last 30 days</h2>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" />Income</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive" />Expense</span>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={days} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="g-in" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.62 0.15 155)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="oklch(0.62 0.15 155)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="g-out" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.58 0.22 27)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="oklch(0.58 0.22 27)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} stroke="var(--color-muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => fmtMoney(v)}
              />
              <Area type="monotone" dataKey="income" stroke="oklch(0.62 0.15 155)" fill="url(#g-in)" strokeWidth={2} />
              <Area type="monotone" dataKey="expense" stroke="oklch(0.58 0.22 27)" fill="url(#g-out)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b p-5"><h2 className="text-sm font-medium">Recent transactions</h2></div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : txs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No transactions yet.</div>
        ) : (
          <ul className="divide-y">
            {txs.slice(0, 6).map((t) => (
              <li key={t.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <div className="font-medium">{t.description || t.category}</div>
                  <div className="text-xs text-muted-foreground">{t.occurred_on} · {t.category}</div>
                </div>
                <div className={t.type === "income" ? "text-success font-medium" : "text-destructive font-medium"}>
                  {t.type === "income" ? "+" : "−"}{fmtMoney(Number(t.amount))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
