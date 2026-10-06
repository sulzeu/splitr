import { useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Perforation } from "@/components/Perforation";
import { ReceiptCropDialog } from "@/components/ReceiptCropDialog";
import { useBill } from "@/context/BillContext";

export function ItemsScreen({ onNext }: { onNext: () => void }) {
  const { bill, addItem, importReceipt, removeItem } = useBill();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [pendingImage, setPendingImage] = useState<{
    src: string;
    mimeType: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!bill) return null;

  const submit = () => {
    const trimmedName = name.trim();
    const parsedPrice = parseFloat(price);
    if (!trimmedName || Number.isNaN(parsedPrice) || parsedPrice < 0) return;
    void addItem({ name: trimmedName, price: parsedPrice, quantity: 1 });
    setName("");
    setPrice("");
  };

  const handleScan = async (file: File | undefined) => {
    if (!file) return;
    setScanNotice(null);
    try {
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read receipt image"));
        reader.readAsDataURL(file);
      });
      setPendingImage({ src, mimeType: file.type || "image/jpeg" });
    } catch (error) {
      setScanNotice(error instanceof Error ? error.message : "Could not read receipt image.");
    }
  };

  const handleImport = async (
    imageBase64: string,
    mimeType: string,
    reference?: { imageBase64: string; mimeType: string }
  ) => {
    setScanBusy(true);
    setScanNotice(null);
    try {
      await importReceipt(imageBase64, mimeType, reference);
      setPendingImage(null);
    } catch (error) {
      setScanNotice(error instanceof Error ? error.message : "Receipt scan failed.");
    } finally {
      setScanBusy(false);
    }
  };

  const itemsTotal = bill.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <div>
      <h1 className="h1">What was ordered?</h1>
      <p className="body-faint" style={{ margin: "4px 0 16px" }}>
        Add each item at its per-unit price. Receipt quantities are split into separate items.
      </p>

      <button
        onClick={() => {
          if (fileInputRef.current) fileInputRef.current.value = "";
          fileInputRef.current?.click();
        }}
        disabled={scanBusy}
        style={{
          width: "100%",
          padding: "8px",
          border: "1px dashed var(--perforation)",
          background: "transparent",
          cursor: "pointer",
        }}
      >
        <span className="body-text" style={{ color: "var(--ink-faint)" }}>
          {scanBusy ? "Extracting receipt items..." : "Scan receipt"}
        </span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => void handleScan(event.target.files?.[0])}
        style={{ display: "none" }}
      />
      {scanNotice && !pendingImage && (
        <p className="body-faint" style={{ color: "var(--outstanding)", marginTop: 4 }}>
          {scanNotice}
        </p>
      )}
      {pendingImage && (
        <ReceiptCropDialog
          imageSrc={pendingImage.src}
          mimeType={pendingImage.mimeType}
          isProcessing={scanBusy}
          error={scanNotice}
          onCancel={() => setPendingImage(null)}
          onConfirm={(imageBase64, mimeType, referenceImageBase64, referenceMimeType) =>
            void handleImport(imageBase64, mimeType, {
              imageBase64: referenceImageBase64,
              mimeType: referenceMimeType,
            })
          }
          onUseOriginal={(imageBase64, mimeType) => void handleImport(imageBase64, mimeType)}
        />
      )}

      <Perforation />

      <div className="row">
        <input
          className="text-input"
          style={{ flex: 1.4 }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Item name"
        />
        <input
          className="text-input numeric"
          style={{ flex: 0.7, marginLeft: 8 }}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0.00"
          inputMode="decimal"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <Button
          label="Add"
          onClick={submit}
          variant="secondary"
          style={{ marginLeft: 8, flexShrink: 0 }}
        />
      </div>

      <div style={{ marginTop: 8 }}>
        {bill.items.length === 0 ? (
          <p className="body-faint">No items added yet.</p>
        ) : (
          bill.items.map((item) => (
            <div key={item.id} className="row" style={{ padding: "8px 0" }}>
              <span className="body-text" style={{ flex: 1 }}>
                {item.name}
                {item.quantity > 1 ? ` × ${item.quantity}` : ""}
              </span>
              <span className="amount">${(item.price * item.quantity).toFixed(2)}</span>
              <button
                className="btn-danger-text"
                style={{ marginLeft: 8 }}
                onClick={() => void removeItem(item.id)}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      <Perforation marginVertical={8} />
      <div className="row" style={{ padding: "8px 0" }}>
        <span className="label" style={{ flex: 1 }}>
          ITEMS TOTAL
        </span>
        <span className="amount">${itemsTotal.toFixed(2)}</span>
      </div>

      <Button
        label="Next — assign items"
        onClick={onNext}
        disabled={bill.items.length < 1}
        style={{ marginTop: 16, width: "100%" }}
      />
    </div>
  );
}
