import { ipcMain } from "electron";

const API_BASE = "http://localhost:3001/api";

export function registerMealTypeHandlers() {
  ipcMain.handle("meal-type:get-all", async () => {
    const res = await fetch(`${API_BASE}/meal-types`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

  ipcMain.handle("meal-type:get-by-id", async (_event, id: string) => {
    const res = await fetch(`${API_BASE}/meal-types/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

  ipcMain.handle(
    "meal-type:create",
    async (_event, data: { name: string; sortOrder?: number }) => {
      const res = await fetch(`${API_BASE}/meal-types`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }
  );

  ipcMain.handle(
    "meal-type:update",
    async (
      _event,
      id: string,
      data: { name?: string; sortOrder?: number }
    ) => {
      const res = await fetch(`${API_BASE}/meal-types/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }
  );

  ipcMain.handle("meal-type:delete", async (_event, id: string) => {
    const res = await fetch(`${API_BASE}/meal-types/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });
}
