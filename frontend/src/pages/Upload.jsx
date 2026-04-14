import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { apiUrl } from "../lib/api.js";

export default function Upload() {
  const navigate = useNavigate();
  const { refreshFileLabel } = useOutletContext();
  const { token, logout } = useAuth();
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [successRows, setSuccessRows] = useState(null);
  const [loadedInfo, setLoadedInfo] = useState({
    filename: null,
    count: null,
  });

  const loadCurrent = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/summary"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) {
        setLoadedInfo({ filename: null, count: null });
        return;
      }
      const data = await res.json();
      setLoadedInfo({
        filename: data.filename || null,
        count: data.transaction_count ?? null,
      });
    } catch {
      setLoadedInfo({ filename: null, count: null });
    }
  }, [token, logout]);

  useEffect(() => {
    loadCurrent();
  }, [loadCurrent]);

  const uploadFile = async (file) => {
    if (!file) return;
    setError("");
    setSuccessRows(null);
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(apiUrl("/api/upload"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (res.status === 401) {
        logout();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Upload failed.");
        return;
      }
      setSuccessRows(data.rows);
      await loadCurrent();
      if (refreshFileLabel) await refreshFileLabel();
    } catch {
      setError("Network error while uploading.");
    } finally {
      setUploading(false);
    }
  };

  const onInputChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) uploadFile(f);
    e.target.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag(false);
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f && f.name.toLowerCase().endsWith(".csv")) {
      uploadFile(f);
    } else {
      setError("Please drop a .csv file.");
    }
  };

  const zoneClass =
    "upload-zone" +
    (drag ? " upload-zone--drag" : "") +
    (successRows != null ? " upload-zone--success" : "") +
    (error && !uploading && successRows == null ? " upload-zone--error" : "");

  return (
    <div className="upload-page">
      <div className="upload-section-card">
        <h2 className="upload-section-title">Upload transactions</h2>

        <div
          className={zoneClass}
          role="button"
          tabIndex={0}
          onClick={() => {
            if (uploading || successRows != null) return;
            inputRef.current && inputRef.current.click();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!uploading && successRows == null) {
                inputRef.current && inputRef.current.click();
              }
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!uploading && successRows == null) setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={uploading || successRows != null ? undefined : onDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={onInputChange}
          />

          {uploading ? (
            <>
              <div className="upload-zone-spinner" aria-hidden />
              <div className="upload-zone-title">Uploading…</div>
            </>
          ) : successRows != null ? (
            <>
              <div className="upload-zone-icon" aria-hidden>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 13l4 4L19 7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="upload-success-title">
                {successRows} transactions loaded
              </div>
              <div className="upload-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/");
                  }}
                >
                  Go to Dashboard
                </button>
              </div>
            </>
          ) : error ? (
            <>
              <div className="upload-zone-icon" style={{ color: "var(--danger)" }} aria-hidden>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="upload-zone-title">Upload issue</div>
              <p className="upload-error-text">{error}</p>
            </>
          ) : (
            <>
              <div className="upload-zone-icon" aria-hidden>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 4v12m0 0l-4-4m4 4l4-4M5 19h14"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="upload-zone-title">Drag and drop your CSV here</div>
              <div className="upload-zone-hint">
                Or click to browse — bank export (.csv)
              </div>
            </>
          )}
        </div>
      </div>

      <div className="info-card">
        <div className="info-card-title">Currently loaded</div>
        {loadedInfo.filename ? (
          <div className="info-file-row">
            <span className="info-filename">{loadedInfo.filename}</span>
            {loadedInfo.count != null ? (
              <span className="info-count-pill">
                {loadedInfo.count} transactions
              </span>
            ) : null}
          </div>
        ) : (
          <p className="info-empty">No file loaded yet</p>
        )}
      </div>

      <div className="info-card">
        <div className="info-card-title">Supported bank formats</div>
        <div className="bank-grid">
          {["Chase", "Bank of America", "Wells Fargo", "Citi"].map((b) => (
            <div key={b} className="bank-cell">
              {b}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
