import { useEffect, useState } from "react";
import { Heading } from "@/components/ui/heading";
import { Pagination } from "@/components/ui/pagination";
import { usePagination } from "@/hooks/usePagination";

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

  const {
    currentPage,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage,
    canNext,
    canPrev,
  } = usePagination(mealTypes);

  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;
  if (loading) return <p>Loading...</p>;

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Heading as="h2" className="text-admin-header-text">Meal Types</Heading>
        <button onClick={onAdd}>+ Add New</button>
      </div>
      <table className="table-fixed w-full" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left" }}>
            <th style={{ minWidth: 150 }}>Name</th>
            <th style={{ minWidth: 150 }}>Sort Order</th>
            <th style={{ width: 180 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedItems.map((mt) => (
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
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPrev={prevPage}
        onNext={nextPage}
        canPrev={canPrev}
        canNext={canNext}
      />
    </section>
  );
}
