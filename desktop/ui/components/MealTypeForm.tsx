import { useEffect, useState } from "react";

const MEAL_PERIODS = ["BREAKFAST", "LUNCH", "DINNER", "DESSERT", "BEVERAGE"];

interface Props {
  editId: string | null;
  onSaved: () => void;
  onCancel: () => void;
}

export default function MealTypeForm({ editId, onSaved, onCancel }: Props) {
  const [name, setName] = useState(MEAL_PERIODS[0]);
  const [sortOrder, setSortOrder] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editId) return;
    window.electron.mealType.getById(editId).then((mt) => {
      setName(mt.name);
      setSortOrder(mt.sortOrder);
    }).catch((e) => setError(e.message));
  }, [editId]);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      if (editId) {
        await window.electron.mealType.update(editId, { name, sortOrder });
      } else {
        await window.electron.mealType.create({ name, sortOrder });
      }
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2>{editId ? "Edit Meal Type" : "New Meal Type"}</h2>
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      <div style={{ display: "grid", gap: "0.5rem", maxWidth: 300 }}>
        <select value={name} onChange={(e) => setName(e.target.value)}>
          {MEAL_PERIODS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
          placeholder="Sort order"
        />
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </section>
  );
}
