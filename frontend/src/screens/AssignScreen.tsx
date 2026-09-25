import { Button } from "@/components/Button";
import { Perforation } from "@/components/Perforation";
import { useBill } from "@/context/BillContext";

export function AssignScreen({ onNext }: { onNext: () => void }) {
  const { bill, toggleAssignment } = useBill();
  if (!bill) return null;
  const unassignedCount = bill.items.filter((i) => i.assignedTo.length === 0).length;

  return (
    <div>
      <h1 className="h1">Who had what?</h1>
      <p className="body-faint" style={{ margin: "4px 0 16px" }}>
        Tap a name to assign. Tap more than one if an item was shared.
      </p>

      {bill.items.map((item, idx) => (
        <div key={item.id}>
          {idx > 0 && <Perforation marginVertical={8} />}
          <div className="row">
            <span className="body-text" style={{ flex: 1 }}>
              {item.name}
            </span>
            <span className="amount">${item.price.toFixed(2)}</span>
          </div>
          <div className="chip-row">
            {bill.people.map((person) => {
              const active = item.assignedTo.includes(person.id);
              return (
                <button
                  key={person.id}
                  className={`chip ${active ? "active" : ""}`}
                  onClick={() => void toggleAssignment(item.id, person.id)}
                >
                  {person.name}
                </button>
              );
            })}
          </div>
          {item.assignedTo.length === 0 && (
            <p className="body-faint" style={{ color: "var(--outstanding)", marginTop: 2 }}>
              Not assigned yet
            </p>
          )}
        </div>
      ))}

      <Perforation />

      <Button
        label={
          unassignedCount > 0
            ? `${unassignedCount} item${unassignedCount > 1 ? "s" : ""} unassigned — see summary anyway`
            : "See the split"
        }
        onClick={onNext}
        style={{ width: "100%" }}
      />
    </div>
  );
}
