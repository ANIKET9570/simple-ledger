import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Trash2, ArrowUp, ArrowDown, Search, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/format";

export const Route = createFileRoute("/app/contacts")({
  head: () => ({ meta: [{ title: "Contacts — Ledgr" }] }),
  component: ContactsPage,
});

type Contact = {
  id: string;
  name: string;
  type: "customer" | "vendor";
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
};

type Transaction = {
  id: string;
  type: "income" | "expense";
  amount: number;
  occurred_on: string;
  category: string;
  description: string | null;
  contact_id: string | null;
};

function ContactsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"customer" | "vendor">("customer");
  const [searchTerm, setSearchTerm] = useState("");
  const [actionType, setActionType] = useState<"credit" | "payment" | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [showEditTransactionModal, setShowEditTransactionModal] = useState(false);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Contact[];
    },
  });

  const { data: txs } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("occurred_on", { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
  });

  const filteredContacts = (contacts || [])
    .filter((c) => c.type === filterType)
    .filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const selectedContact = selectedContactId
    ? (contacts || []).find((c) => c.id === selectedContactId)
    : null;

  const selectedContactTxs = selectedContactId
    ? (txs || []).filter((t) => t.contact_id === selectedContactId)
    : [];

  // Separate and sort transactions (ascending - oldest first)
  const creditTxs = selectedContactTxs
    .filter((t) => t.type === "expense")
    .sort((a, b) => new Date(a.occurred_on).getTime() - new Date(b.occurred_on).getTime());
  
  const debitTxs = selectedContactTxs
    .filter((t) => t.type === "income")
    .sort((a, b) => new Date(a.occurred_on).getTime() - new Date(b.occurred_on).getTime());

  // Calculate balances for credit transactions
  let creditBalance = 0;
  const creditTxsWithBalance = creditTxs.map((t) => {
    creditBalance += Number(t.amount);
    return { ...t, balance: creditBalance };
  });

  // Calculate balances for debit transactions
  let debitBalance = 0;
  const debitTxsWithBalance = debitTxs.map((t) => {
    debitBalance += Number(t.amount);
    return { ...t, balance: debitBalance };
  });

  const totalCredit = creditTxs.reduce((acc, t) => acc + Number(t.amount), 0);
  const totalDebit = debitTxs.reduce((acc, t) => acc + Number(t.amount), 0);
  const finalBalance = totalDebit - totalCredit;

  const create = useMutation({
    mutationFn: async (f: Omit<Contact, "id" | "created_at">) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("contacts").insert({ ...f, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const addTransaction = useMutation({
    mutationFn: async (data: { amount: number; type: "income" | "expense"; description: string; date: string }) => {
      if (!user || !selectedContact) throw new Error("Missing data");
      const { error } = await supabase.from("transactions").insert({
        user_id: user.id,
        contact_id: selectedContact.id,
        amount: data.amount,
        type: data.type,
        category: data.type === "expense" ? "Credit Given" : "Payment Received",
        description: data.description,
        occurred_on: data.date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setActionType(null);
      toast.success("Transaction added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      setSelectedContactId(null);
      toast.success("Customer deleted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const updateContact = useMutation({
    mutationFn: async (data: Omit<Contact, "id" | "created_at">) => {
      if (!selectedContact) throw new Error("No contact selected");
      const { error } = await supabase.from("contacts").update(data).eq("id", selectedContact.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      setShowEditModal(false);
      toast.success("Customer updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const updateTransaction = useMutation({
    mutationFn: async (data: { amount: number; description: string; date: string }) => {
      if (!editingTransactionId) throw new Error("No transaction selected");
      const { error } = await supabase
        .from("transactions")
        .update({
          amount: data.amount,
          description: data.description,
          occurred_on: data.date,
        })
        .eq("id", editingTransactionId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setShowEditTransactionModal(false);
      setEditingTransactionId(null);
      toast.success("Transaction updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const handleSelectContact = (id: string) => {
    setSelectedContactId(id);
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-7rem)] gap-4 lg:gap-0">
      {/* Left Panel - Customer List */}
      <div className="w-full lg:w-96 lg:border-r flex flex-col rounded-lg lg:rounded-none bg-card overflow-hidden">
        <div className="p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search Customer"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex gap-2">
            {(["customer", "vendor"] as const).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setFilterType(type);
                  setSelectedContactId(null);
                }}
                className={`flex-1 py-2 lg:py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                  filterType === type
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent/60"
                }`}
              >
                {type === "customer" ? "CUSTOMERS" : "SUPPLIER"}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="w-full flex items-center justify-center gap-2 py-3 lg:py-2.5 rounded-lg bg-success text-white text-sm font-medium hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add {filterType === "customer" ? "Customer" : "Supplier"}
          </button>
        </div>

        {/* Added Customers Section */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase">Added {filterType}s</h3>
          {isLoading ? (
            <div className="text-center text-xs text-muted-foreground">Loading...</div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground">No {filterType}s yet</div>
          ) : (
            <div className="space-y-2">
              {filteredContacts.map((contact) => {
                const contactBalance = (txs || [])
                  .filter((t) => t.contact_id === contact.id)
                  .reduce((acc, t) => acc + (t.type === "income" ? Number(t.amount) : -Number(t.amount)), 0);

                return (
                  <div
                    key={contact.id}
                    className="flex gap-2 items-center group"
                  >
                    <button
                      onClick={() => handleSelectContact(contact.id)}
                      className={`flex-1 text-left p-3 rounded-lg border transition-colors hover:bg-accent/60 ${
                        selectedContactId === contact.id
                          ? "bg-primary/10 border-primary"
                          : "bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-sm">{contact.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">Last activity on May 11, 2026</div>
                        </div>
                        <div className={`text-sm font-semibold ${contactBalance < 0 ? "text-destructive" : "text-success"}`}>
                          ₹{Math.abs(contactBalance)}
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(contact.id)}
                      className="p-2.5 lg:p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/15 hover:text-destructive text-muted-foreground"
                      title="Delete customer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Transaction History */}
      {selectedContact ? (
        <div className="flex-1 flex flex-col w-full lg:w-auto">
          {/* Customer Header */}
          <div className="flex items-center justify-between p-4 lg:p-6 border-b rounded-t-lg bg-card">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 lg:h-12 lg:w-12 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
                {selectedContact.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="font-semibold text-lg">{selectedContact.name}</h2>
                <p className="text-xs text-muted-foreground">View Profile Settings ▶</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowReportModal(true)} className="px-4 py-2.5 lg:py-2 rounded-lg border text-green-600 border-green-600 text-sm font-medium hover:bg-green-50">
                📋 Report
              </button>
              <button onClick={() => setShowEditModal(true)} className="px-4 py-2 rounded-lg border text-blue-600 border-blue-600 text-sm font-medium hover:bg-blue-50">
                ✏️ Edit
              </button>
            </div>
          </div>

          {/* Transactions List View */}
          <div className="flex-1 overflow-y-auto p-6">
            {creditTxsWithBalance.length === 0 && debitTxsWithBalance.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No transactions yet</div>
            ) : (
              <div className="space-y-6">
                {/* Bills Section */}
                {creditTxsWithBalance.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-destructive">BILL AMOUNT</h3>
                    <div className="space-y-2">
                      {creditTxsWithBalance.map((t) => (
                        <div key={t.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/30 transition">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-destructive/15">
                              <ArrowDown className="h-5 w-5 text-destructive" />
                            </div>
                            <div>
                              <div className="font-semibold text-lg text-destructive">
                                {fmtMoney(Number(t.amount))}
                              </div>
                              <div className="text-xs text-muted-foreground">{t.occurred_on}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">Due</div>
                              <div className="font-semibold text-destructive">
                                {fmtMoney(t.balance)}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setEditingTransactionId(t.id);
                                setShowEditTransactionModal(true);
                              }}
                              className="p-2 hover:bg-accent rounded-lg transition"
                            >
                              <Edit2 className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                      <span className="text-sm font-medium">Total Due</span>
                      <span className="font-bold text-destructive">{fmtMoney(totalCredit)}</span>
                    </div>
                  </div>
                )}

                {/* Payments Section */}
                {debitTxsWithBalance.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-success">PAYMENT RECEIVED (Amount Paid)</h3>
                    <div className="space-y-2">
                      {debitTxsWithBalance.map((t) => (
                        <div key={t.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/30 transition">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-success/15">
                              <ArrowUp className="h-5 w-5 text-success" />
                            </div>
                            <div>
                              <div className="font-semibold text-lg text-success">
                                +{fmtMoney(Number(t.amount))}
                              </div>
                              <div className="text-xs text-muted-foreground">{t.occurred_on}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">Paid</div>
                              <div className="font-semibold text-success">
                                {fmtMoney(t.balance)}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setEditingTransactionId(t.id);
                                setShowEditTransactionModal(true);
                              }}
                              className="p-2 hover:bg-accent rounded-lg transition"
                            >
                              <Edit2 className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/30">
                      <span className="text-sm font-medium">Total Paid</span>
                      <span className="font-bold text-success">{fmtMoney(totalDebit)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Actions */}
          <div className="border-t p-6 bg-card space-y-4 rounded-b-lg">
            <div className="flex items-center justify-between p-4 rounded-lg bg-card border">
              <div>
                <div className="text-xs text-muted-foreground">Due Amount</div>
                <div className={`text-2xl font-bold ${totalCredit > totalDebit ? "text-destructive" : "text-success"}`}>
                  {fmtMoney(Math.abs(finalBalance))}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setActionType("payment")}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-green-600 text-green-600 font-semibold hover:bg-green-50"
              >
                ↓ Payment
              </button>
              <button
                onClick={() => setActionType("credit")}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-red-600 text-red-600 font-semibold hover:bg-red-50"
              >
                ↑ Credit
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Select a customer to view details
        </div>
      )}

      {/* Action Modal */}
      {actionType && selectedContact && (
        <TransactionModal
          actionType={actionType}
          contactName={selectedContact.name}
          onClose={() => setActionType(null)}
          onSubmit={(amount, description, date) => {
            addTransaction.mutate({
              amount,
              type: actionType === "credit" ? "expense" : "income",
              description,
              date,
            });
          }}
          isLoading={addTransaction.isPending}
        />
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <AddCustomerModal
          type={filterType}
          onClose={() => setShowAddModal(false)}
          onSubmit={(data) => {
            create.mutate(data);
            setShowAddModal(false);
          }}
          isLoading={create.isPending}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <DeleteConfirmModal
          contactName={(contacts || []).find((c) => c.id === deleteConfirmId)?.name || ""}
          onConfirm={() => {
            deleteContact.mutate(deleteConfirmId);
            setDeleteConfirmId(null);
          }}
          onCancel={() => setDeleteConfirmId(null)}
          isLoading={deleteContact.isPending}
        />
      )}

      {/* Edit Customer Modal */}
      {showEditModal && selectedContact && (
        <EditCustomerModal
          contact={selectedContact}
          onClose={() => setShowEditModal(false)}
          onSubmit={(data) => {
            updateContact.mutate(data);
          }}
          isLoading={updateContact.isPending}
        />
      )}

      {/* Report Modal */}
      {showReportModal && selectedContact && (
        <ReportModal
          contact={selectedContact}
          creditTxs={creditTxsWithBalance}
          debitTxs={debitTxsWithBalance}
          totalCredit={totalCredit}
          totalDebit={totalDebit}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {/* Edit Transaction Modal */}
      {showEditTransactionModal && editingTransactionId && selectedContactTxs && (
        <EditTransactionModal
          transaction={selectedContactTxs.find((t) => t.id === editingTransactionId)!}
          onClose={() => {
            setShowEditTransactionModal(false);
            setEditingTransactionId(null);
          }}
          onSubmit={(amount, description, date) => {
            updateTransaction.mutate({ amount, description, date });
          }}
          isLoading={updateTransaction.isPending}
        />
      )}
    </div>
  );
}

function TransactionModal({
  actionType,
  contactName,
  onClose,
  onSubmit,
  isLoading,
}: {
  actionType: "credit" | "payment";
  contactName: string;
  onClose: () => void;
  onSubmit: (amount: number, description: string, date: string) => void;
  isLoading: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-lg border bg-card p-4 lg:p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">
          {actionType === "credit" ? "Give Credit" : "Receive Payment"} - {contactName}
        </h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (amount) onSubmit(parseFloat(amount), description, date);
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-xs font-medium text-muted-foreground">Amount (₹)</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-ring"
              placeholder="0.00"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g., Cash, UPI, Cheque"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-lg border hover:bg-accent text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !amount}
              className="flex-1 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {isLoading ? "..." : actionType === "credit" ? "Give Credit" : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddCustomerModal({
  type,
  onClose,
  onSubmit,
  isLoading,
}: {
  type: "customer" | "vendor";
  onClose: () => void;
  onSubmit: (data: Omit<Contact, "id" | "created_at">) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-lg border bg-card p-4 lg:p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">
          Add New {type === "customer" ? "Customer" : "Supplier"}
        </h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) {
              onSubmit({ name, type, email: email || null, phone: phone || null, notes: notes || null });
              setName("");
              setEmail("");
              setPhone("");
              setNotes("");
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-xs font-medium text-muted-foreground">Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-ring"
              placeholder={`${type === "customer" ? "Customer" : "Supplier"} name`}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-ring"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-ring"
              placeholder="10-digit phone number"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-ring text-sm resize-none"
              placeholder="Any additional notes..."
              rows={3}
            />
          </div>
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border hover:bg-accent text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {isLoading ? "..." : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  contactName,
  onConfirm,
  onCancel,
  isLoading,
}: {
  contactName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-lg border bg-card p-4 lg:p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-2">Delete Customer?</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Are you sure you want to permanently delete <strong>{contactName}</strong>? This action cannot be undone.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg border hover:bg-accent text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? "..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditCustomerModal({
  contact,
  onClose,
  onSubmit,
  isLoading,
}: {
  contact: Contact;
  onClose: () => void;
  onSubmit: (data: Omit<Contact, "id" | "created_at">) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState(contact.name);
  const [email, setEmail] = useState(contact.email || "");
  const [phone, setPhone] = useState(contact.phone || "");
  const [notes, setNotes] = useState(contact.notes || "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-lg border bg-card p-4 lg:p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Edit Customer</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) {
              onSubmit({ name, type: contact.type, email: email || null, phone: phone || null, notes: notes || null });
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-xs font-medium text-muted-foreground">Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-ring"
              placeholder="Customer name"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-ring"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-ring"
              placeholder="10-digit phone number"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-ring text-sm resize-none"
              placeholder="Any additional notes..."
              rows={3}
            />
          </div>
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border hover:bg-accent text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {isLoading ? "..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReportModal({
  contact,
  creditTxs,
  debitTxs,
  totalCredit,
  totalDebit,
  onClose,
}: {
  contact: Contact;
  creditTxs: (Transaction & { balance: number })[];
  debitTxs: (Transaction & { balance: number })[];
  totalCredit: number;
  totalDebit: number;
  onClose: () => void;
}) {
  const handleDownloadCSV = () => {
    let csv = `Report for ${contact.name}\n\n`;
    csv += `PAYMENT RECEIVED\n`;
    csv += `Date,Amount\n`;
    debitTxs.forEach((t) => {
      csv += `${t.occurred_on},${t.amount}\n`;
    });
    csv += `Total Paid,${totalDebit}\n\n`;
    csv += `BILL AMOUNT\n`;
    csv += `Date,Amount\n`;
    creditTxs.forEach((t) => {
      csv += `${t.occurred_on},${t.amount}\n`;
    });
    csv += `Total Bill,${totalCredit}\n`;
    csv += `Total Due,${totalCredit - totalDebit}\n`;

    const element = document.createElement("a");
    element.setAttribute("href", "data:text/csv;charset=utf-8," + encodeURIComponent(csv));
    element.setAttribute("download", `${contact.name}-report.csv`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl max-h-[90vh] rounded-lg border bg-card p-4 lg:p-6 shadow-lg overflow-y-auto">
        <div className="flex items-center justify-between mb-4 lg:mb-6">
          <h3 className="text-xl lg:text-2xl font-semibold">{contact.name} - Report</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">
            ✕
          </button>
        </div>

        {/* Report Content - Two Column Layout */}
        <div className="grid grid-cols-2 gap-8 mb-6">
          {/* Left Column - Payments */}
          <div className="flex flex-col">
            <h4 className="text-lg font-semibold text-success mb-4">PAYMENT RECEIVED</h4>
            <div className="flex-1 space-y-2 mb-4">
              {debitTxs.length > 0 ? (
                debitTxs.map((t) => (
                  <div key={t.id} className="flex justify-between items-start p-3 rounded-lg border bg-card text-sm">
                    <div>
                      <div className="font-medium text-success">{fmtMoney(Number(t.amount))}</div>
                      <div className="text-xs text-muted-foreground">{t.occurred_on}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground text-center py-4">No payments</div>
              )}
            </div>
            {debitTxs.length > 0 && (
              <div className="p-3 rounded-lg bg-success/10 border border-success/30">
                <div className="text-xs text-muted-foreground mb-1">Total Paid</div>
                <div className="font-bold text-success text-lg">{fmtMoney(totalDebit)}</div>
              </div>
            )}
          </div>

          {/* Right Column - Bills */}
          <div className="flex flex-col">
            <h4 className="text-lg font-semibold text-destructive mb-4">BILL AMOUNT</h4>
            <div className="flex-1 space-y-2 mb-4">
              {creditTxs.length > 0 ? (
                creditTxs.map((t) => (
                  <div key={t.id} className="flex justify-between items-start p-3 rounded-lg border bg-card text-sm">
                    <div>
                      <div className="font-medium text-destructive">{fmtMoney(Number(t.amount))}</div>
                      <div className="text-xs text-muted-foreground">{t.occurred_on}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground text-center py-4">No bills</div>
              )}
            </div>
            {creditTxs.length > 0 && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                  <div className="text-xs text-muted-foreground mb-1">Total Bill</div>
                  <div className="font-bold text-destructive text-lg">{fmtMoney(totalCredit)}</div>
                </div>
                <div className={`p-3 rounded-lg border ${totalCredit > totalDebit ? "bg-destructive/10 border-destructive/30" : "bg-success/10 border-success/30"}`}>
                  <div className="text-xs text-muted-foreground mb-1">Total Due</div>
                  <div className={`font-bold text-lg ${totalCredit > totalDebit ? "text-destructive" : "text-success"}`}>
                    {fmtMoney(totalCredit - totalDebit)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Download Button */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={handleDownloadCSV}
            className="w-full py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:opacity-90"
          >
            📥 Download CSV
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-2 rounded-lg border hover:bg-accent text-sm font-medium"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function EditTransactionModal({
  transaction,
  onClose,
  onSubmit,
  isLoading,
}: {
  transaction: Transaction;
  onClose: () => void;
  onSubmit: (amount: number, description: string, date: string) => void;
  isLoading: boolean;
}) {
  const [amount, setAmount] = useState(String(transaction.amount));
  const [description, setDescription] = useState(transaction.description || "");
  const [date, setDate] = useState(transaction.occurred_on);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-lg border bg-card p-4 lg:p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Edit Transaction</h3>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="0"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Description"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border text-sm font-medium hover:bg-accent"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(Number(amount), description, date)}
            className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            disabled={isLoading || !amount}
          >
            {isLoading ? "Updating..." : "Update"}
          </button>
        </div>
      </div>
    </div>
  );
}
