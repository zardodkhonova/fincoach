import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { apiUrl } from "../lib/api.js";

const BADGE_STYLES = {
  Shopping: { bg: "#ede9fe", text: "#5b21b6" },
  Food: { bg: "#dcfce7", text: "#15803d" },
  Health: { bg: "#fee2e2", text: "#b91c1c" },
  Transport: { bg: "#dbeafe", text: "#1d4ed8" },
  Utilities: { bg: "#fef3c7", text: "#b45309" },
  Entertainment: { bg: "#fae8ff", text: "#a21caf" },
  Uncategorized: { bg: "#f3f4f6", text: "#374151" },
};

function formatAmountCell(raw) {
  const v = Number(raw) || 0;
  const out = v > 0 ? -v : v;
  return out.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function badgeForCategory(name) {
  return BADGE_STYLES[name] || BADGE_STYLES.Uncategorized;
}

export default function Transactions() {
  const { token, logout } = useAuth();
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState(["All"]);
  const [months, setMonths] = useState(["All"]);
  const [category, setCategory] = useState("All");
  const [month, setMonth] = useState("All");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadMeta = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/summary"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) {
        setCategories(["All"]);
        setMonths(["All"]);
        return;
      }
      const data = await res.json();
      const cats = ["All", ...(data.categories || [])];
      const mos = ["All", ...(data.months || [])];
      setCategories(cats);
      setMonths(mos);
    } catch {
      setCategories(["All"]);
      setMonths(["All"]);
    }
  }, [token, logout]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("category", category);
      params.set("month", month);
      const res = await fetch(
        apiUrl(`/api/transactions?${params.toString()}`),
        {
        headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.status === 401) {
        logout();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to load transactions.");
        setRows([]);
        return;
      }
      setRows(data.transactions || []);
    } catch {
      setError("Network error.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [category, month, token, logout]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  return (
    <div className="tx-page">
      <div className="tx-filters">
        <label>
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Month
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="tx-table-card">
        {loading ? (
          <div className="tx-empty">Loading transactions…</div>
        ) : error ? (
          <div className="tx-empty">{error}</div>
        ) : rows.length === 0 ? (
          <div className="tx-empty">No transactions match your filters</div>
        ) : (
          <table className="tx-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Merchant</th>
                <th>Category</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const b = badgeForCategory(r.category);
                return (
                  <tr key={`${r.date}-${idx}`}>
                    <td className="tx-date">{r.date}</td>
                    <td>{r.description}</td>
                    <td>
                      <span
                        className="tx-badge"
                        style={{
                          background: b.bg,
                          color: b.text,
                        }}
                      >
                        {r.category}
                      </span>
                    </td>
                    <td className="tx-amt">{formatAmountCell(r.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
