"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import RoleBadge from "@/components/RoleBadge";

// Real, new page per direct client request: a genuine expenses page —
// salaries, rent, running costs, transport, logistics, and real
// income — for agents, managers, and CHS itself. One shared page,
// since the underlying real data is scoped identically to whoever is
// logged in, whichever role they hold.
const CATEGORIES = ["salary", "rent", "utilities", "transport", "logistics", "maintenance", "marketing", "commission_income", "other"] as const;

interface ExpenseEntry {
  id: string;
  direction: "income" | "expense";
  category: string;
  description: string;
  amount: number;
  entry_date: string;
}

export default function ExpensesPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [summary, setSummary] = useState<{ total_income: number; total_expense: number; by_category: { category: string; direction: string; total: number }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [period, setPeriod] = useState<"week" | "month" | "quarter">("month");

  const [direction, setDirection] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState<typeof CATEGORIES[number]>("transport");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function getRange(p: typeof period) {
    const end = new Date();
    const start = new Date();
    if (p === "week") start.setDate(start.getDate() - 7);
    else if (p === "month") start.setMonth(start.getMonth() - 1);
    else start.setMonth(start.getMonth() - 3);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }

  async function loadData(p: typeof period) {
    const { start, end } = getRange(p);
    const { data: summaryData } = await supabase.rpc("get_my_expense_summary", { p_start_date: start, p_end_date: end });
    setSummary(summaryData);

    const { data: entriesData } = await supabase
      .from("expense_entries")
      .select("id, direction, category, description, amount, entry_date")
      .gte("entry_date", start)
      .lte("entry_date", end)
      .order("entry_date", { ascending: false });
    setEntries(entriesData || []);
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session]);

  async function handleSubmit() {
    if (!description.trim() || !amount) {
      setError("Please add a real description and amount.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("add_expense_entry", {
      p_direction: direction, p_category: category, p_description: description.trim(), p_amount: Number(amount),
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setDescription("");
    setAmount("");
    setShowForm(false);
    loadData(period);
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] pb-10">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <button onClick={() => router.back()} className="text-xs text-white/70">← Back</button>
        <RoleBadge label="Expenses & Income" />
        <h1 className="font-serif text-lg font-bold mt-1">My Real Expenses & Income</h1>
      </div>

      <div className="px-4 py-4 space-y-3">
        <div className="flex gap-2">
          {(["week", "month", "quarter"] as const).map((p) => (
            <button key={p} onClick={() => { setPeriod(p); loadData(p); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${period === p ? "bg-chs-red text-white" : "bg-gray-100 text-gray-600"}`}>
              {p === "week" ? "This Week" : p === "month" ? "This Month" : "This Quarter"}
            </button>
          ))}
        </div>

        {summary && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 p-3">
              <p className="text-xl font-bold text-green-700">{formatNaira(summary.total_income)}</p>
              <p className="text-[10px] text-gray-400">Real income</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3">
              <p className="text-xl font-bold text-chs-red">{formatNaira(summary.total_expense)}</p>
              <p className="text-[10px] text-gray-400">Real expenses</p>
            </div>
            <div className="col-span-2 bg-chs-charcoal rounded-xl p-3">
              <p className="text-[10px] uppercase text-white/60 font-semibold">Net position</p>
              <p className={`text-lg font-bold ${summary.total_income - summary.total_expense >= 0 ? "text-white" : "text-red-300"}`}>
                {formatNaira(summary.total_income - summary.total_expense)}
              </p>
            </div>
          </div>
        )}

        <button onClick={() => setShowForm(!showForm)} className="w-full py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold">
          {showForm ? "Cancel" : "+ Add a real entry"}
        </button>

        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <div className="flex gap-2">
              <button onClick={() => setDirection("expense")} className={`flex-1 py-2 rounded-full text-xs font-semibold ${direction === "expense" ? "bg-chs-red text-white" : "bg-gray-100 text-gray-600"}`}>
                Expense
              </button>
              <button onClick={() => setDirection("income")} className={`flex-1 py-2 rounded-full text-xs font-semibold ${direction === "income" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                Income
              </button>
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value as typeof CATEGORIES[number])}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
            </select>
            <input type="text" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <input type="number" placeholder="Amount (₦)" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            {error && <p className="text-xs text-chs-red">{error}</p>}
            <button onClick={handleSubmit} disabled={submitting}
              className="w-full py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
              {submitting ? "Saving..." : "Save real entry"}
            </button>
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-xs font-bold text-chs-charcoal">Entries this period ({entries.length})</p>
          {entries.length === 0 ? (
            <p className="text-xs text-gray-400">No real entries yet.</p>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="bg-white rounded-lg border border-gray-100 p-2.5 flex justify-between items-center">
                <div>
                  <p className="text-xs font-semibold text-chs-charcoal">{e.description}</p>
                  <p className="text-[10px] text-gray-400 capitalize">{e.category.replace(/_/g, " ")} · {new Date(e.entry_date).toLocaleDateString()}</p>
                </div>
                <p className={`text-xs font-bold ${e.direction === "income" ? "text-green-700" : "text-chs-red"}`}>
                  {e.direction === "income" ? "+" : "-"}{formatNaira(e.amount)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
