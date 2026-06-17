import { useEffect, useState } from "react";

const defaultForm = {
  name: "",
  category: "",
  brand: "",
  description: "",
  stock: 0,
  price: 0,
  isFeatured: false,
};

export default function MenuManager() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(defaultForm);
  const [editing, setEditing] = useState<string | null>(null);

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

  function set<K extends keyof typeof defaultForm>(key: K, value: (typeof defaultForm)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function slugify(text: string) {
    return text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }

  async function handleSave() {
    setError("");
    try {
      const payload = { ...form, slug: slugify(form.name) };
      if (editing) {
        await window.electron.menu.update(editing, payload);
        setEditing(null);
      } else {
        await window.electron.menu.create(payload);
      }
      setForm(defaultForm);
      await fetchAll();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleDelete(id: string) {
    setError("");
    try {
      await window.electron.menu.delete(id);
      await fetchAll();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function startEdit(item: MenuItem) {
    setForm({
      name: item.name,
      category: item.category,
      brand: item.brand,
      description: item.description,
      stock: item.stock,
      price: item.price,
      isFeatured: item.isFeatured,
    });
    setEditing(item.id);
  }

  function cancelEdit() {
    setForm(defaultForm);
    setEditing(null);
  }

  return (
    <section>
      <h2>Menu Items</h2>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th>Name</th>
              <th>Category</th>
              <th>Brand</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Featured</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} style={{ borderTop: "1px solid #ccc" }}>
                <td>{item.name}</td>
                <td>{item.category}</td>
                <td>{item.brand}</td>
                <td>${Number(item.price).toFixed(2)}</td>
                <td>{item.stock}</td>
                <td>{item.isFeatured ? "Yes" : "No"}</td>
                <td>
                  <button onClick={() => startEdit(item)}>Edit</button>
                  <button onClick={() => handleDelete(item.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <hr />

      <h3>{editing ? "Edit Menu Item" : "Create Menu Item"}</h3>

      <div style={{ display: "grid", gap: "0.5rem", maxWidth: 400 }}>
        <input placeholder="Name" value={form.name} onChange={(e) => set("name", e.target.value)} />
        <input placeholder="Category" value={form.category} onChange={(e) => set("category", e.target.value)} />
        <input placeholder="Brand" value={form.brand} onChange={(e) => set("brand", e.target.value)} />
        <textarea placeholder="Description" value={form.description} onChange={(e) => set("description", e.target.value)} />
        <input type="number" placeholder="Stock" value={form.stock} onChange={(e) => set("stock", Number(e.target.value))} />
        <input type="number" step="0.01" placeholder="Price" value={form.price} onChange={(e) => set("price", Number(e.target.value))} />
        <label>
          <input type="checkbox" checked={form.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} />
          {" "}Featured
        </label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={handleSave}>{editing ? "Save" : "Create"}</button>
          {editing && <button onClick={cancelEdit}>Cancel</button>}
        </div>
      </div>
    </section>
  );
}
