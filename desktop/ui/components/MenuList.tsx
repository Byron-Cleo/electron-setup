import { useEffect, useState } from "react";
import { Heading } from "@/components/ui/heading";
import { Pagination } from "@/components/ui/pagination";
import { usePagination } from "@/hooks/usePagination";

interface Props {
  onEdit: (id: string) => void;
  onAdd: () => void;
}

export default function MenuList({ onEdit, onAdd }: Props) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchAll() {
    setLoading(true);
    setError("");
    try {
      const data = await window.electron.menu.getAll();
      setItems(data);
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
      await window.electron.menu.delete(id);
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
  } = usePagination(items);

  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;
  if (loading) return <p>Loading...</p>;

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Heading as="h2" className="text-admin-header-text">Menu Items</Heading>
        <button onClick={onAdd}>+ Add New</button>
      </div>
      <table className="table-fixed w-full" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left" }}>
            <th style={{ minWidth: 150 }}>Name</th>
            <th style={{ minWidth: 150 }}>Category</th>
            <th style={{ minWidth: 150 }}>Brand</th>
            <th style={{ minWidth: 150 }}>Price</th>
            <th style={{ minWidth: 150 }}>Stock</th>
            <th style={{ minWidth: 150 }}>Featured</th>
            <th style={{ width: 180 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedItems.map((item) => (
            <tr key={item.id} style={{ borderTop: "1px solid #ccc" }}>
              <td>{item.name}</td>
              <td>{item.category}</td>
              <td>{item.brand}</td>
              <td>${Number(item.price).toFixed(2)}</td>
              <td>{item.stock}</td>
              <td>{item.isFeatured ? "Yes" : "No"}</td>
              <td>
                <button onClick={() => onEdit(item.id)}>Edit</button>
                <button onClick={() => handleDelete(item.id)}>Delete</button>
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
