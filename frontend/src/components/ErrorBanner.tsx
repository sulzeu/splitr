import { useBill } from "@/context/BillContext";

export function ErrorBanner() {
  const { error, clearError } = useBill();
  if (!error) return null;

  return (
    <div
      className="row-between"
      style={{
        background: "var(--outstanding-bg)",
        border: "1px solid var(--outstanding)",
        color: "var(--outstanding)",
        padding: "8px 12px",
        marginBottom: 16,
      }}
    >
      <span className="body-text" style={{ color: "var(--outstanding)" }}>
        {error}
      </span>
      <button
        onClick={clearError}
        style={{ background: "none", border: "none", color: "var(--outstanding)", cursor: "pointer", fontSize: 16 }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
