import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

const API_URL = import.meta.env.VITE_API_URL;

const CAT_HEX = {
  Shopping: "#6d56d6",
  Food: "#16a34a",
  Health: "#dc4e26",
  Transport: "#2563eb",
  Utilities: "#d97706",
  Entertainment: "#c026d3",
  Uncategorized: "#6b7280",
};

function fmtMoney(n) {
  return Math.abs(Number(n) || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function fmtMoneySignedExpense(raw) {
  const v = Number(raw) || 0;
  const out = v > 0 ? -v : v;
  return out.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function pickBiggestCategory(byCategory) {
  const entries = Object.entries(byCategory || {});
  if (!entries.length) return { name: "—", value: 0 };
  entries.sort((a, b) => b[1] - a[1]);
  return { name: entries[0][0], value: entries[0][1] };
}

function buildInsights(summary) {
  const bullets = [];
  const byCat = summary.by_category || {};
  const byMonth = summary.by_month || {};

  const catEntries = Object.entries(byCat).filter(([, v]) => v > 0);

  if (catEntries.length) {
    catEntries.sort((a, b) => b[1] - a[1]);
    const [hiName, hiVal] = catEntries[0];

    bullets.push({
      tone: "warning",
      text: `${hiName} is your highest spend category at ${fmtMoney(
        hiVal
      )}.`,
    });
  }

  const heavyMonths = Object.entries(byMonth).filter(([, v]) => v > 1000);

  if (heavyMonths.length) {
    heavyMonths.sort((a, b) => b[1] - a[1]);
    const parts = heavyMonths.map(([m, v]) => `${m} (${fmtMoney(v)})`);

    bullets.push({
      tone: "danger",
      text: `High spending months: ${parts.join(", ")}.`,
    });
  } else {
    bullets.push({
      tone: "success",
      text: "Spending is steady across months.",
    });
  }

  return bullets.slice(0, 3);
}

export default function Dashboard() {
  const { token, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`${API_URL}/api/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          logout();
          return;
        }

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          if (!cancelled) {
            setError(data.error || "Could not load summary.");
            setSummary(null);
          }
          return;
        }

        if (!cancelled) setSummary(data);
      } catch {
        if (!cancelled) setError("Network error.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, logout]);

  const biggestCat = useMemo(
    () => (summary ? pickBiggestCategory(summary.by_category) : null),
    [summary]
  );

  const insights = useMemo(
    () => (summary ? buildInsights(summary) : []),
    [summary]
  );

  if (loading) return <div>Loading...</div>;

  if (error || !summary) {
    return (
      <div>
        <h2>Dashboard</h2>
        <p>{error || "No data yet."}</p>
      </div>
    );
  }

  const bt = summary.biggest_transaction || {};

  return (
    <div>
      <h2>Dashboard</h2>

      <p>Total: {fmtMoney(summary.total)}</p>
      <p>Transactions: {summary.transaction_count}</p>
      <p>Biggest category: {biggestCat.name}</p>

      <h3>Insights</h3>
      {insights.map((i, idx) => (
        <p key={idx}>{i.text}</p>
      ))}

      <p>
        Biggest transaction: {bt.date} - {bt.description} (
        {fmtMoneySignedExpense(bt.amount)})
      </p>
    </div>
  );
}