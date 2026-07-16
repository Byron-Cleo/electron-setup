import { useEffect, useState } from "react";
import { Heading } from "@/components/ui/heading";

interface Props {
  onEdit: (id: string) => void;
  onAdd: () => void;
}

export default function MealTypeList({ onEdit, onAdd }: Props) {
  const [mealTypes, setMealTypes] = useState<MealType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  async function handleDelete(id: string) {
    setError("");
    try {
      await window.electron.mealType.delete(id);
      await fetchAll();
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;
  if (loading) return <p>Loading...</p>;

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Heading as="h2" className="text-admin-header-text">Meal Types</Heading>
        <button onClick={onAdd}>+ Add New</button>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left" }}>
            <th>Name</th>
            <th>Sort Order</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {mealTypes.map((mt) => (
            <tr key={mt.id} style={{ borderTop: "1px solid #ccc" }}>
              <td>{mt.name}</td>
              <td>{mt.sortOrder}</td>
              <td>
                <button onClick={() => onEdit(mt.id)}>Edit</button>
                <button onClick={() => handleDelete(mt.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
