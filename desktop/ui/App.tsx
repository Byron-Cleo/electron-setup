import { useState } from "react";
import MealTypeList from "./components/MealTypeList";
import MealTypeForm from "./components/MealTypeForm";
import MenuList from "./components/MenuList";
import MenuForm from "./components/MenuForm";

type Tab = "meal-types" | "menu";

function App() {
  const [tab, setTab] = useState<Tab>("meal-types");
  const [view, setView] = useState<"list" | "create" | `edit-${string}`>("list");

  function navigate(view: "list" | "create" | `edit-${string}`) {
    setView(view);
  }

  function switchTab(t: Tab) {/models
    setTab(t);
    setView("list");
  }

  if (view === "create" || view.startsWith("edit-")) {
    const editId = view.startsWith("edit-") ? view.slice(5) : null;

    if (tab === "meal-types") {
      return (
        <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
          <button onClick={() => navigate("list")}>← Back to List</button>
          <MealTypeForm editId={editId} onSaved={() => navigate("list")} onCancel={() => navigate("list")} />
        </main>
      );
    }

    return (
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <button onClick={() => navigate("list")}>← Back to List</button>
        <MenuForm editId={editId} onSaved={() => navigate("list")} onCancel={() => navigate("list")} />
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Eraeva POS</h1>
      <nav style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button
          onClick={() => switchTab("meal-types")}
          style={{
            fontWeight: tab === "meal-types" ? "bold" : "normal",
            background: tab === "meal-types" ? "#ddd" : "transparent",
            border: "1px solid #aaa",
            padding: "0.4rem 1rem",
            cursor: "pointer",
          }}
        >
          Meal Types
        </button>
        <button
          onClick={() => switchTab("menu")}
          style={{
            fontWeight: tab === "menu" ? "bold" : "normal",
            background: tab === "menu" ? "#ddd" : "transparent",
            border: "1px solid #aaa",
            padding: "0.4rem 1rem",
            cursor: "pointer",
          }}
        >
          Menu Items
        </button>
      </nav>

      {tab === "meal-types" && (
        <MealTypeList onEdit={(id) => navigate(`edit-${id}`)} onAdd={() => navigate("create")} />
      )}
      {tab === "menu" && (
        <MenuList onEdit={(id) => navigate(`edit-${id}`)} onAdd={() => navigate("create")} />
      )}
    </main>
  );
}

export default App;
