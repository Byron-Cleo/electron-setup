import { useEffect, useState } from "react";
import { Heading } from "@/components/ui/heading";
import { DataTable } from "@/components/ui/data-table";
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
      <DataTable
        columns={[
          { label: "Name", key: "name" },
          { label: "Category", key: "category" },
          { label: "Brand", key: "brand" },
          { label: "Price", key: "price" },
          { label: "Stock", key: "stock" },
          { label: "Featured", key: "featured" },
          { label: "Actions", key: "actions", isAction: true },
        ]}
        data={paginatedItems}
        renderCell={(item, column) => {
          switch (column.key) {
            case "name":
              return <span>{item.name}</span>
            case "category":
              return <span>{item.category}</span>
            case "brand":
              return <span>{item.brand}</span>
            case "price":
              return <span>${Number(item.price).toFixed(2)}</span>
            case "stock":
              return <span>{item.stock}</span>
            case "featured":
              return <span>{item.isFeatured ? "Yes" : "No"}</span>
            case "actions":
              return (
                <>
                  <button onClick={() => onEdit(item.id)}>Edit</button>
                  <button onClick={() => handleDelete(item.id)}>Delete</button>
                </>
              )
            default:
              return null
          }
        }}
        keyExtractor={(item) => item.id}
        emptyMessage="No menu items found"
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
