function truncateFilename(name, maxLen) {
  if (!name || name === "No file loaded") return null;
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 3) + "...";
}

export default function Topbar({ title, fileLabel }) {
  const loaded = fileLabel && fileLabel !== "No file loaded";
  const display = loaded ? truncateFilename(fileLabel, 20) : "No file loaded";

  return (
    <header className="topbar">
      <div className="topbar-title">{title}</div>
      <div
        className={
          "topbar-pill " +
          (loaded ? "topbar-pill--loaded" : "topbar-pill--empty")
        }
        title={fileLabel}
      >
        {display}
      </div>
    </header>
  );
}
