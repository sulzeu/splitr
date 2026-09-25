import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Perforation } from "@/components/Perforation";
import { useBill } from "@/context/BillContext";
import { api, ApiError } from "@/api/client";
import { Bill } from "@/types";

export function HomeScreen({ onEnterBill }: { onEnterBill: () => void }) {
  const { createBill, joinBill, openBill, loading } = useBill();
  const [mode, setMode] = useState<"choose" | "join">("choose");
  const [code, setCode] = useState("");
  const [history, setHistory] = useState<{ active: Bill[]; paid: Bill[] }>({ active: [], paid: [] });
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    api.getAccountBills().then(setHistory).catch((error) => {
      setHistoryError(error instanceof ApiError ? error.message : "Couldn't load your bill history.");
    });
  }, []);

  const handleCreate = async () => {
    if (await createBill()) onEnterBill();
  };

  const handleJoin = async () => {
    if (!code.trim()) return;
    if (await joinBill(code)) onEnterBill();
  };

  return (
    <div>
      <div className="row">
        <span className="wordmark">SPLIT</span>
        <span className="wordmark" style={{ color: "var(--settled)" }}>
          RECEIPT
        </span>
      </div>
      <p className="body-faint" style={{ marginTop: 4 }}>
        Everyone pays what they actually ordered — not an even share.
      </p>

      <Perforation marginVertical={24} />

      {mode === "choose" ? (
        <>
          <Button label="Start a new split" onClick={handleCreate} disabled={loading} style={{ width: "100%" }} />
          <Button
            label="Join a split with a code"
            variant="secondary"
            onClick={() => setMode("join")}
            disabled={loading}
            style={{ width: "100%", marginTop: 8 }}
          />
          {(history.active.length > 0 || history.paid.length > 0) && (
            <div style={{ marginTop: 24 }}>
              <span className="label">YOUR BILLS</span>
              {history.active.map((bill) => (
                <HistoryButton key={bill.id} bill={bill} onOpen={openBill} onEnter={onEnterBill} />
              ))}
              {history.paid.length > 0 && <span className="label" style={{ display: "block", marginTop: 16 }}>PAID</span>}
              {history.paid.map((bill) => (
                <HistoryButton key={bill.id} bill={bill} onOpen={openBill} onEnter={onEnterBill} />
              ))}
            </div>
          )}
          {historyError && <p className="body-faint" style={{ color: "var(--outstanding)" }}>{historyError}</p>}
        </>
      ) : (
        <>
          <span className="label">SPLIT CODE</span>
          <input
            className="text-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. H3HBHP"
            maxLength={6}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            style={{ marginTop: 4, letterSpacing: "0.1em", textAlign: "center", fontFamily: "var(--font-display)" }}
          />
          <Button
            label={loading ? "Joining…" : "Join"}
            onClick={handleJoin}
            disabled={loading || code.trim().length < 6}
            style={{ width: "100%", marginTop: 12 }}
          />
          <button
            className="btn-danger-text"
            onClick={() => setMode("choose")}
            style={{ marginTop: 12, color: "var(--ink-faint)" }}
          >
            ← back
          </button>
        </>
      )}

      <p className="body-faint" style={{ marginTop: 24 }}>
        Receipt scanning isn't wired up in this build yet — you'll add items manually for now.
      </p>
    </div>
  );
}

function HistoryButton({ bill, onOpen, onEnter }: { bill: Bill; onOpen: (id: string) => Promise<boolean>; onEnter: () => void }) {
  return (
    <button
      className="row-between"
      onClick={() => void onOpen(bill.id).then((opened) => opened && onEnter())}
      style={{ width: "100%", border: "none", borderBottom: "1px dashed var(--perforation)", background: "transparent", padding: "10px 0", cursor: "pointer" }}
    >
      <span className="body-text">{bill.title}</span>
      <span className="body-faint">{new Date(bill.createdAt).toLocaleDateString()}</span>
    </button>
  );
}
