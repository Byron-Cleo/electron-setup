import { ipcMain } from "electron";

const API_BASE = "http://localhost:3001/api";

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function registerMealTypeHandlers() {
  ipcMain.handle("meal-type:get-all", async () => apiFetch("/meal-types"));
  ipcMain.handle("meal-type:get-by-id", async (_event, id: string) => apiFetch(`/meal-types/${id}`));
  ipcMain.handle("meal-type:create", async (_event, data) =>
    apiFetch("/meal-types", { method: "POST", body: JSON.stringify(data) })
  );
  ipcMain.handle("meal-type:update", async (_event, id: string, data) =>
    apiFetch(`/meal-types/${id}`, { method: "PUT", body: JSON.stringify(data) })
  );
  ipcMain.handle("meal-type:delete", async (_event, id: string) =>
    apiFetch(`/meal-types/${id}`, { method: "DELETE" })
  );
}

export function registerMenuHandlers() {
  ipcMain.handle("menu:get-all", async () => apiFetch("/menu"));
  ipcMain.handle("menu:get-by-id", async (_event, id: string) => apiFetch(`/menu/${id}`));
  ipcMain.handle("menu:get-by-meal-type", async (_event, mealType: string) => apiFetch(`/menu?mealType=${encodeURIComponent(mealType)}`));
  ipcMain.handle("menu:create", async (_event, data) =>
    apiFetch("/menu", { method: "POST", body: JSON.stringify(data) })
  );
  ipcMain.handle("menu:update", async (_event, id: string, data) =>
    apiFetch(`/menu/${id}`, { method: "PUT", body: JSON.stringify(data) })
  );
  ipcMain.handle("menu:delete", async (_event, id: string) =>
    apiFetch(`/menu/${id}`, { method: "DELETE" })
  );
}

export function registerAuthHandlers() {
  ipcMain.handle("auth:login", async (_event, pin: string) =>
    apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ pin }) })
  );
  ipcMain.handle("auth:logout", async () =>
    apiFetch("/auth/logout", { method: "POST" })
  );
}

export function registerStockSupplyCategoryHandlers() {
  ipcMain.handle("stock-supply-category:get-all", async () => apiFetch("/stock-supply-categories"));
  ipcMain.handle("stock-supply-category:get-by-id", async (_event, id: string) => apiFetch(`/stock-supply-categories/${id}`));
  ipcMain.handle("stock-supply-category:create", async (_event, data) =>
    apiFetch("/stock-supply-categories", { method: "POST", body: JSON.stringify(data) })
  );
  ipcMain.handle("stock-supply-category:update", async (_event, id: string, data) =>
    apiFetch(`/stock-supply-categories/${id}`, { method: "PUT", body: JSON.stringify(data) })
  );
  ipcMain.handle("stock-supply-category:delete", async (_event, id: string) =>
    apiFetch(`/stock-supply-categories/${id}`, { method: "DELETE" })
  );
}

export function registerStockSupplyHandlers() {
  ipcMain.handle("stock-supply:get-all", async () => apiFetch("/stock-supplies"));
  ipcMain.handle("stock-supply:get-by-id", async (_event, id: string) => apiFetch(`/stock-supplies/${id}`));
  ipcMain.handle("stock-supply:create", async (_event, data) =>
    apiFetch("/stock-supplies", { method: "POST", body: JSON.stringify(data) })
  );
  ipcMain.handle("stock-supply:update", async (_event, id: string, data) =>
    apiFetch(`/stock-supplies/${id}`, { method: "PUT", body: JSON.stringify(data) })
  );
  ipcMain.handle("stock-supply:delete", async (_event, id: string) =>
    apiFetch(`/stock-supplies/${id}`, { method: "DELETE" })
  );
}

export function registerStockRequestHandlers() {
  ipcMain.handle("stock-request:get-all", async (_event, status?: string) => {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return apiFetch(`/stock-requests${query}`);
  });
  ipcMain.handle("stock-request:get-by-id", async (_event, id: string) => apiFetch(`/stock-requests/${id}`));
  ipcMain.handle("stock-request:create", async (_event, data) =>
    apiFetch("/stock-requests", { method: "POST", body: JSON.stringify(data) })
  );
  ipcMain.handle("stock-request:fulfill", async (_event, id: string, data) =>
    apiFetch(`/stock-requests/${id}/fulfill`, { method: "PUT", body: JSON.stringify(data) })
  );
}
