import { useEffect, useState } from "react";
import { Heading } from "@/components/ui/heading";
import { DataTable } from "@/components/ui/data-table";
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
      <DataTable
        columns={[
          { label: "Name", key: "name" },
          { label: "Sort Order", key: "sortOrder" },
          { label: "Actions", key: "actions", isAction: true },
        ]}
        data={paginatedItems}
        renderCell={(mt, column) => {
          switch (column.key) {
            case "name":
              return <span>{mt.name}</span>
            case "sortOrder":
              return <span>{mt.sortOrder}</span>
            case "actions":
              return (
                <>
                  <button onClick={() => onEdit(mt.id)}>Edit</button>
                  <button onClick={() => handleDelete(mt.id)}>Delete</button>
                </>
              )
            default:
              return null
          }
        }}
        keyExtractor={(mt) => mt.id}
        emptyMessage="No meal types found"
        pagination={{
          currentPage,
          totalPages,
          onPrev: prevPage,
          onNext: nextPage,
          canPrev,
          canNext,
        }}
      />
    </section>
  );
}
