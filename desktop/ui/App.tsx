import { useState } from "react";
import MealTypeManager from "./components/MealTypeManager";
import MenuManager from "./components/MenuManager";

const tabs = ["Meal Types", "Menu Items"] as const;

function App() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Meal Types");

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Eraeva POS</h1>
      <nav style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              fontWeight: tab === t ? "bold" : "normal",
              background: tab === t ? "#ddd" : "transparent",
              border: "1px solid #aaa",
              padding: "0.4rem 1rem",
              cursor: "pointer",
            }}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "Meal Types" && <MealTypeManager />}
      {tab === "Menu Items" && <MenuManager />}
    </main>
  );
}

export default App;
