import { useEffect, useState } from "react";

const MEAL_PERIODS = ["BREAKFAST", "LUNCH", "DINNER", "DESSERT", "BEVERAGE"];

export default function MealTypeManager() {
  const [mealTypes, setMealTypes] = useState<MealType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState(MEAL_PERIODS[0]);
  const [sortOrder, setSortOrder] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);

  async function fetchAll() {
    setLoading(true);
    setError("");
    try {
      const data = await window.electron.mealType.getAll();
      setMealTypes(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  async function handleCreate() {
    setError("");
    try {
      await window.electron.mealType.create({ name, sortOrder });
      setName(MEAL_PERIODS[0]);
      setSortOrder(0);
      await fetchAll();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleUpdate(id: string) {
    setError("");
    try {
      await window.electron.mealType.update(id, { name, sortOrder });
      setEditing(null);
      await fetchAll();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleDelete(id: string) {
    setError("");
    try {
      await window.electron.mealType.delete(id);
      await fetchAll();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function startEdit(mt: MealType) {
    setName(mt.name);
    setSortOrder(mt.sortOrder);
    setEditing(mt.id);
  }

  return (
    <section>
      <h2>Meal Types</h2>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <ul>
          {mealTypes.map((mt) => (
            <li key={mt.id}>
              <strong>{mt.name}</strong> (sort: {mt.sortOrder})
              <button onClick={() => startEdit(mt)}>Edit</button>
              <button onClick={() => handleDelete(mt.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}

      <hr />

      <h3>{editing ? "Edit Meal Type" : "Create Meal Type"}</h3>
      <select value={name} onChange={(e) => setName(e.target.value)}>
        {MEAL_PERIODS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <input
        type="number"
        value={sortOrder}
        onChange={(e) => setSortOrder(Number(e.target.value))}
        placeholder="Sort order"
      />
      {editing ? (
        <button onClick={() => handleUpdate(editing)}>Save</button>
      ) : (
        <button onClick={handleCreate}>Create</button>
      )}
      {editing && <button onClick={() => setEditing(null)}>Cancel</button>}
    </section>
  );
}
