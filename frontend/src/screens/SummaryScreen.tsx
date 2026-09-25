import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Perforation } from "@/components/Perforation";
import { useBill } from "@/context/BillContext";
import { GstMode } from "@/types";

const GST_OPTIONS: { mode: GstMode; label: string }[] = [
  { mode: "inclusive", label: "Included in prices" },
  { mode: "exclusive", label: "Add on top" },
  { mode: "none", label: "No GST" },
];

export function SummaryScreen({ onRestart }: { onRestart: () => void }) {
  const { bill, split, readOnly, setGstMode, setTipAmount, setServiceFeeAmount, setPersonSettled, setBillPaid, leaveBill } = useBill();
  const [tipText, setTipText] = useState("");
  const [feeText, setFeeText] = useState("");
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  useEffect(() => {
    if (bill) {
      setTipText(bill.tipAmount ? String(bill.tipAmount) : "");
      setFeeText(bill.serviceFeeAmount ? String(bill.serviceFeeAmount) : "");
    }
  }, [bill?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!bill || !split) return null;

  const commitTip = () => {
    const v = parseFloat(tipText);
    void setTipAmount(Number.isNaN(v) || v < 0 ? 0 : v);
  };
  const commitFee = () => {
    const v = parseFloat(feeText);
    void setServiceFeeAmount(Number.isNaN(v) || v < 0 ? 0 : v);
  };

  const buildMessage = () => {
    const lines = split.personTotals.map((pt) => {
      const person = bill.people.find((p) => p.id === pt.personId);
      return `${person?.name ?? "?"}: $${pt.total.toFixed(2)}`;
    });
    return [bill.title, `Join code: ${bill.joinCode}`, ...lines, "", `Total: $${split.grandTotal.toFixed(2)}`].join(
      "\n"
    );
  };

  const shareSummary = async () => {
    const message = buildMessage();
    if (navigator.share) {
      try {
        await navigator.share({ text: message, title: bill.title });
        return;
      } catch {
        // user cancelled the native share sheet — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(message);
      setShareNotice("Copied to clipboard.");
      setTimeout(() => setShareNotice(null), 3000);
    } catch {
      setShareNotice("Couldn't copy automatically — select the summary text manually.");
    }
  };

  return (
    <div>
      <h1 className="h1">The split</h1>
      {readOnly && <p className="body-faint" style={{ color: "var(--settled)", marginTop: 4 }}>Read-only view from the split code.</p>}

      {!readOnly && <div style={{ marginTop: 16 }}>
        <span className="label">GST</span>
        <div className="chip-row">
          {GST_OPTIONS.map((opt) => (
            <button
              key={opt.mode}
              className={`chip ${bill.gstMode === opt.mode ? "active" : ""}`}
              onClick={() => void setGstMode(opt.mode)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>}

      {!readOnly && <div className="row" style={{ marginTop: 16, gap: 8 }}>
        <div style={{ flex: 1 }}>
          <span className="label">TIP (total $)</span>
          <input
            className="text-input numeric"
            value={tipText}
            onChange={(e) => setTipText(e.target.value)}
            onBlur={commitTip}
            placeholder="0.00"
            inputMode="decimal"
            style={{ marginTop: 4 }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <span className="label">SERVICE FEE (total $)</span>
          <input
            className="text-input numeric"
            value={feeText}
            onChange={(e) => setFeeText(e.target.value)}
            onBlur={commitFee}
            placeholder="0.00"
            inputMode="decimal"
            style={{ marginTop: 4 }}
          />
        </div>
      </div>}

      <Perforation />

      {split.unassignedSubtotal > 0 && (
        <p className="body-faint" style={{ color: "var(--outstanding)", marginBottom: 8 }}>
          ${split.unassignedSubtotal.toFixed(2)} of items still unassigned — go back and assign them so the
          split is accurate.
        </p>
      )}

      {split.personTotals.map((pt, idx) => {
        const person = bill.people.find((p) => p.id === pt.personId);
        const isPaid = bill.settledPersonIds.includes(pt.personId);
        return (
          <div key={pt.personId}>
            {idx > 0 && <Perforation marginVertical={8} />}
            <div className="row">
              <div style={{ flex: 1 }}>
                <div className="body-text">{person?.name}</div>
                <div className="body-faint">
                  items ${pt.itemsSubtotal.toFixed(2)}
                  {bill.gstMode !== "none"
                    ? ` · gst ${bill.gstMode === "inclusive" ? "incl." : `$${pt.gstShare.toFixed(2)}`}`
                    : ""}
                  {bill.tipAmount > 0 ? ` · tip $${pt.tipShare.toFixed(2)}` : ""}
                  {bill.serviceFeeAmount > 0 ? ` · fee $${pt.serviceFeeShare.toFixed(2)}` : ""}
                </div>
              </div>
              <span className="amount-large">${pt.total.toFixed(2)}</span>
            </div>
            {!readOnly && <button
              className="row"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 4 }}
              onClick={() => void setPersonSettled(pt.personId, !isPaid)}
            >
              <span className={`checkbox ${isPaid ? "checked" : ""}`} />
              <span className="body-faint" style={isPaid ? { color: "var(--settled)" } : undefined}>
                {isPaid ? "Paid" : "Mark as paid"}
              </span>
            </button>}
          </div>
        );
      })}

      <Perforation />
      <div className="row">
        <span className="h2" style={{ flex: 1 }}>
          TOTAL
        </span>
        <span className="amount-large">${split.grandTotal.toFixed(2)}</span>
      </div>

      <Button label="Share summary" onClick={shareSummary} style={{ marginTop: 16, width: "100%" }} />
      {!readOnly && <Button
        label={bill.paidAt ? "Move back to active bills" : "Mark bill as paid"}
        variant="secondary"
        onClick={() => void setBillPaid(!bill.paidAt)}
        style={{ marginTop: 8, width: "100%" }}
      />}
      {shareNotice && (
        <p className="body-faint" style={{ marginTop: 4, textAlign: "center" }}>
          {shareNotice}
        </p>
      )}
      <Button
        label="Start a new split"
        variant="secondary"
        onClick={() => {
          leaveBill();
          onRestart();
        }}
        style={{ marginTop: 8, width: "100%" }}
      />
    </div>
  );
}
