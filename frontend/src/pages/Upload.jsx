import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const API_URL = import.meta.env.VITE_API_URL;

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
      const res = await fetch(`${API_URL}/api/summary`, {
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
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
    const f = e.target.files?.[0];
    if (f) uploadFile(f);
    e.target.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);

    const f = e.dataTransfer.files?.[0];

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
        <h2>Upload transactions</h2>

        <div
          className={zoneClass}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            hidden
            onChange={onInputChange}
          />

          {uploading
            ? "Uploading..."
            : successRows != null
            ? `${successRows} transactions loaded`
            : error
            ? error
            : "Drag and drop CSV or click to upload"}
        </div>
      </div>

      <div className="info-card">
        <div>Currently loaded</div>

        {loadedInfo.filename ? (
          <div>
            {loadedInfo.filename} ({loadedInfo.count} transactions)
          </div>
        ) : (
          <div>No file loaded yet</div>
        )}
      </div>
    </div>
  );
}