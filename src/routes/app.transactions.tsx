import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmtMoney } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/transactions")({
  head: () => ({ meta: [{ title: "Transactions — Ledgr" }] }),
  component: TransactionsPage,
});

type Tx = {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string | null;
  occurred_on: string;
  contact_id: string | null;
  contacts: { name: string } | null;
};

function TransactionsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: txs, isLoading } = useQuery({
    queryKey: ["transactions"],
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
          .select("id,type,amount,category,description,occurred_on,contact_id,contacts(name)")
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
      
      return allData as unknown as Tx[];
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["contacts-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("id,name,type").order("name");
      if (error) throw error;
      return data;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard-tx"] });
      toast.success("Transaction deleted");
    },
  });

  const create = useMutation({
    mutationFn: async (form: {
      type: "income" | "expense";
      amount: number;
      category: string;
      description: string;
      occurred_on: string;
      contact_id: string | null;
    }) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("transactions").insert({ ...form, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard-tx"] });
      setOpen(false);
      toast.success("Transaction added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">Every income and expense, in order.</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : !txs || txs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
            <button
              onClick={() => setOpen(true)}
              className="mt-3 text-sm font-medium text-foreground hover:underline"
            >
              Add your first one
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium w-10">S.No</th>
                <th className="px-4 py-2.5 text-left font-medium">Date</th>
                <th className="px-4 py-2.5 text-left font-medium">Description</th>
                <th className="px-4 py-2.5 text-left font-medium">Category</th>
                <th className="px-4 py-2.5 text-left font-medium">Contact</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {txs.map((t, index) => (
                <tr key={t.id} className="hover:bg-accent/40">
                  <td className="px-4 py-3 text-muted-foreground font-medium">{index + 1}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.occurred_on}</td>
                  <td className="px-4 py-3">{t.description || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md border bg-background px-2 py-0.5 text-xs">{t.category}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{t.contacts?.name ?? "—"}</td>
                  <td className={`px-4 py-3 text-right font-medium ${t.type === "income" ? "text-success" : "text-destructive"}`}>
                    {t.type === "income" ? "+" : "−"}{fmtMoney(Number(t.amount))}
                  </td>
                  <td className="px-2 py-3">
                    <button
                      onClick={() => del.mutate(t.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <NewTxDialog
          contacts={contacts ?? []}
          onClose={() => setOpen(false)}
          onSubmit={(f) => create.mutate(f)}
          submitting={create.isPending}
        />
      )}
    </div>
  );
}

function NewTxDialog({
  contacts,
  onClose,
  onSubmit,
  submitting,
}: {
  contacts: { id: string; name: string; type: string }[];
  onClose: () => void;
  onSubmit: (f: {
    type: "income" | "expense";
    amount: number;
    category: string;
    description: string;
    occurred_on: string;
    contact_id: string | null;
  }) => void;
  submitting: boolean;
}) {
  const [type, setType] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [contactId, setContactId] = useState<string>("");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl"
      >
        <h3 className="text-lg font-semibold">New transaction</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              type,
              amount: parseFloat(amount),
              category: category || "General",
              description,
              occurred_on: occurredOn,
              contact_id: contactId || null,
            });
          }}
          className="mt-5 space-y-4"
        >
          <div className="grid grid-cols-2 gap-2 rounded-md border p-1">
            {(["income", "expense"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  type === t
                    ? t === "income"
                      ? "bg-success text-success-foreground"
                      : "bg-destructive text-destructive-foreground"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount">
              <input
                type="number" step="0.01" min="0" required
                value={amount} onChange={(e) => setAmount(e.target.value)}
                className="input" placeholder="0.00"
              />
            </Field>
            <Field label="Date">
              <input type="date" required value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} className="input" />
            </Field>
          </div>

          <Field label="Category">
            <input value={category} onChange={(e) => setCategory(e.target.value)} className="input" placeholder="Sales, Rent, Supplies…" />
          </Field>
          <Field label="Description">
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="input" placeholder="Optional" />
          </Field>
          <Field label="Contact (optional)">
            <select value={contactId} onChange={(e) => setContactId(e.target.value)} className="input">
              <option value="">— None —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
              ))}
            </select>
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm hover:bg-accent">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
        <style>{`.input{height:2.25rem;width:100%;border-radius:.375rem;border:1px solid var(--color-border);background:var(--color-background);padding:0 .625rem;font-size:.875rem;outline:none}
        .input:focus{box-shadow:0 0 0 2px var(--color-ring)}`}</style>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
