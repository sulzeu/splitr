import { useState } from "react";
import { Button } from "@/components/Button";
import { Perforation } from "@/components/Perforation";
import { useBill } from "@/context/BillContext";

export function PeopleScreen({ onNext }: { onNext: () => void }) {
  const { bill, addPerson, removePerson } = useBill();
  const [name, setName] = useState("");

  if (!bill) return null;

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    void addPerson(trimmed);
    setName("");
  };

  return (
    <div>
      <h1 className="h1">Who's splitting?</h1>
      <p className="body-faint" style={{ margin: "4px 0 16px" }}>
        Add everyone at the table. You'll assign items to them next.
      </p>

      <div className="row">
        <input
          className="text-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoFocus
        />
        <Button label="Add" onClick={submit} variant="secondary" style={{ marginLeft: 8, flexShrink: 0 }} />
      </div>

      <Perforation />

      {bill.people.length === 0 ? (
        <p className="body-faint">No one added yet.</p>
      ) : (
        bill.people.map((p) => (
          <div key={p.id} className="row-between" style={{ padding: "8px 0" }}>
            <span className="body-text">{p.name}</span>
            <button className="btn-danger-text" onClick={() => void removePerson(p.id)}>
              Remove
            </button>
          </div>
        ))
      )}

      <Button
        label={`Next — add items${bill.people.length ? ` (${bill.people.length} people)` : ""}`}
        onClick={onNext}
        disabled={bill.people.length < 1}
        style={{ marginTop: 16, width: "100%" }}
      />
    </div>
  );
}
