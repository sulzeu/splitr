import { useState } from "react";
import { useBill } from "@/context/BillContext";

export function JoinCodeBanner() {
  const { bill } = useBill();
  const [copied, setCopied] = useState(false);

  if (!bill) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(bill.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard permission denied — the code is still visible to read manually
    }
  };

  return (
    <div
      className="row-between"
      style={{
        background: "var(--paper-raised)",
        border: "1px solid var(--perforation)",
        padding: "8px 12px",
        marginBottom: 16,
      }}
    >
      <div>
        <div className="label">SPLIT CODE — share with the table</div>
        <div className="h2" style={{ letterSpacing: "0.08em" }}>
          {bill.joinCode}
        </div>
      </div>
      <button className="btn btn-secondary" onClick={copy} style={{ padding: "6px 10px" }}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
