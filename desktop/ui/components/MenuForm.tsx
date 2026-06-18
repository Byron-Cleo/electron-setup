import { useEffect, useState } from "react";

interface Props {
  editId: string | null;
  onSaved: () => void;
  onCancel: () => void;
}

const defaultForm = {
  name: "",
  category: "",
  brand: "",
  description: "",
  stock: 0,
  price: 0,
  isFeatured: false,
};

export default function MenuForm({ editId, onSaved, onCancel }: Props) {
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editId) return;
    window.electron.menu.getById(editId).then((item) => {
      setForm({
        name: item.name,
        category: item.category,
        brand: item.brand,
        description: item.description,
        stock: item.stock,
        price: Number(item.price),
        isFeatured: item.isFeatured,
      });
    }).catch((e) => setError(e.message));
  }, [editId]);

  function set<K extends keyof typeof defaultForm>(key: K, value: (typeof defaultForm)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function slugify(text: string) {
    return text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, slug: slugify(form.name) };
      if (editId) {
        await window.electron.menu.update(editId, payload);
      } else {
        await window.electron.menu.create(payload);
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
      <h2>{editId ? "Edit Menu Item" : "New Menu Item"}</h2>
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
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
          <button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </section>
  );
}
