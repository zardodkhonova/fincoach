import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtMoneySignedExpense(raw) {
  const v = Number(raw) || 0;
  const out = v > 0 ? -v : v;
  return out.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
      text: `${hiName} is your highest spend category at ${fmtMoney(hiVal)} — worth watching recurring charges.`,
    });
  }

  const heavyMonths = Object.entries(byMonth).filter(([, v]) => v > 1000);
  if (heavyMonths.length) {
    heavyMonths.sort((a, b) => b[1] - a[1]);
    const parts = heavyMonths.map(([m, v]) => `${m} (${fmtMoney(v)})`);
    bullets.push({
      tone: "danger",
      text: `These months exceeded $1,000 in total spend: ${parts.join(", ")}.`,
    });
  } else {
    bullets.push({
      tone: "success",
      text: "No single month crossed $1,000 in total spend — steady pacing.",
    });
  }

  if (catEntries.length > 1) {
    const lows = [...catEntries].sort((a, b) => a[1] - b[1]);
    const [loName, loVal] = lows[0];
    bullets.push({
      tone: "success",
      text: `${loName} is your leanest category at ${fmtMoney(loVal)} — nice discipline there.`,
    });
  } else if (catEntries.length === 1) {
    bullets.push({
      tone: "neutral",
      text: "Only one spending category detected — upload richer data for more insights.",
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
        const res = await fetch("/api/summary", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
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
        if (!cancelled) setError("Network error loading summary.");
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

  const categoryRows = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.by_category || {})
      .map(([name, val]) => ({ name, val }))
      .sort((a, b) => b.val - a.val);
  }, [summary]);

  const maxCat = useMemo(() => {
    if (!categoryRows.length) return 1;
    return Math.max(...categoryRows.map((r) => r.val), 1);
  }, [categoryRows]);

  const monthRows = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.by_month || {})
      .map(([m, v]) => ({ m, v }))
      .sort((a, b) => a.m.localeCompare(b.m));
  }, [summary]);

  const maxMonth = useMemo(() => {
    if (!monthRows.length) return 1;
    return Math.max(...monthRows.map((r) => r.v), 1);
  }, [monthRows]);

  const maxMonthKey = useMemo(() => {
    if (!monthRows.length) return null;
    let best = monthRows[0].m;
    let bestV = monthRows[0].v;
    for (const r of monthRows) {
      if (r.v > bestV) {
        best = r.m;
        bestV = r.v;
      }
    }
    return best;
  }, [monthRows]);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-metrics">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="dash-metric-card">
              <div className="dashboard-skel" style={{ height: 16, width: "40%" }} />
              <div
                className="dashboard-skel"
                style={{ height: 32, width: "70%", marginTop: 16 }}
              />
            </div>
          ))}
        </div>
        <div className="dashboard-row-2">
          <div className="dash-panel">
            <div className="dashboard-skel" style={{ height: 220 }} />
          </div>
          <div className="dash-panel">
            <div className="dashboard-skel" style={{ height: 220 }} />
          </div>
        </div>
        <div className="dash-panel" style={{ marginTop: 16 }}>
          <div className="dashboard-skel" style={{ height: 180 }} />
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="dashboard-page">
        <div className="dash-error-card">
          <div className="dash-error-title">Dashboard</div>
          <p className="dash-muted">{error || "No data yet."}</p>
          <p className="dash-muted" style={{ marginTop: 8 }}>
            Upload a CSV from the Upload page to see metrics.
          </p>
        </div>
      </div>
    );
  }

  const insights = buildInsights(summary);
  const bt = summary.biggest_transaction || {};
  const barMaxPx = 72;

  return (
    <div className="dashboard-page">
      <div className="dashboard-metrics">
        <div className="dash-metric-card">
          <div className="dash-metric-label">Total spent</div>
          <div className="dash-metric-value dash-metric-value--danger">
            {fmtMoney(summary.total)}
          </div>
        </div>
        <div className="dash-metric-card">
          <div className="dash-metric-label">Biggest category</div>
          <div className="dash-metric-value">{biggestCat.name}</div>
          <div className="dash-metric-sub">{fmtMoney(biggestCat.value)}</div>
        </div>
        <div className="dash-metric-card">
          <div className="dash-metric-label">Transactions</div>
          <div className="dash-metric-value">{summary.transaction_count}</div>
        </div>
        <div className="dash-metric-card">
          <div className="dash-metric-label">Savings potential</div>
          <div className="dash-metric-value dash-metric-value--success">
            {fmtMoney(summary.savings_potential)}
          </div>
        </div>
      </div>

      <div className="dashboard-row-2">
        <div className="dash-panel">
          <h2 className="dash-panel-title">Spending by category</h2>
          {categoryRows.map((row) => (
            <div key={row.name} className="dash-cat-row">
              <div
                className="dash-cat-dot"
                style={{
                  background: CAT_HEX[row.name] || CAT_HEX.Uncategorized,
                }}
              />
              <div className="dash-cat-name" title={row.name}>
                {row.name}
              </div>
              <div className="dash-cat-track">
                <div
                  className="dash-cat-fill"
                  style={{
                    width: `${(row.val / maxCat) * 100}%`,
                    background: CAT_HEX[row.name] || CAT_HEX.Uncategorized,
                  }}
                />
              </div>
              <div className="dash-cat-amt">{fmtMoney(row.val)}</div>
            </div>
          ))}
        </div>
        <div className="dash-panel">
          <h2 className="dash-panel-title">AI insights</h2>
          {insights.map((item, idx) => (
            <div key={idx} className="dash-insight-row">
              <div
                className={
                  "dash-insight-dot dash-insight-dot--" + item.tone
                }
              />
              <p className="dash-insight-text">{item.text}</p>
            </div>
          ))}
          <div className="dash-insight-tip">
            Tip: set a weekly cap for your top category and review one
            subscription — you modeled roughly {fmtMoney(summary.savings_potential)}{" "}
            in potential slack this period.
          </div>
        </div>
      </div>

      <div className="dash-panel" style={{ marginTop: 16 }}>
        <h2 className="dash-panel-title">Monthly trend</h2>
        <div className="dash-trend-bars">
          {monthRows.map((row) => {
            const h = Math.max(
              4,
              Math.round((row.v / maxMonth) * barMaxPx)
            );
            const isMax = row.m === maxMonthKey;
            return (
              <div key={row.m} className="dash-trend-col">
                <div className="dash-trend-amt">{fmtMoney(row.v)}</div>
                <div
                  className="dash-trend-bar-wrap"
                  style={{
                    height: barMaxPx,
                    display: "flex",
                    alignItems: "flex-end",
                    width: "100%",
                  }}
                >
                  <div
                    className={
                      "dash-trend-bar " +
                      (isMax
                        ? "dash-trend-bar--max"
                        : "dash-trend-bar--default")
                    }
                    style={{ height: h }}
                    title={fmtMoney(row.v)}
                  />
                </div>
                <div className="dash-trend-month">{row.m}</div>
              </div>
            );
          })}
        </div>
        <p className="dash-footnote">
          Largest month is highlighted in red; other months use a softer
          purple tone.
        </p>
        <p className="dash-footnote">
          Single largest charge: {bt.date || "—"} — {bt.description || "—"} (
          <span className="dash-amt-inline">
            {fmtMoneySignedExpense(bt.amount)}
          </span>
          )
        </p>
      </div>
    </div>
  );
}
