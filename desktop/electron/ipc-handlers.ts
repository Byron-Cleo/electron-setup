import { ipcMain } from "electron";
import { getApiBase } from "./server-config.ts";

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${getApiBase()}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(err?.error || `HTTP ${res.status}`);
  }
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
  ipcMain.handle("menu:list-images", async () => apiFetch("/menu/images"));
  ipcMain.handle("menu:create", async (_event, data) =>
    apiFetch("/menu", { method: "POST", body: JSON.stringify(data) })
  );
  ipcMain.handle("menu:update", async (_event, id: string, data) =>
    apiFetch(`/menu/${id}`, { method: "PUT", body: JSON.stringify(data) })
  );
  ipcMain.handle("menu:delete", async (_event, id: string) =>
    apiFetch(`/menu/${id}`, { method: "DELETE" })
  );
  ipcMain.handle("menu:get-running-low-count", async () => apiFetch("/menu/running-low-count"));
  ipcMain.handle("menu:get-cooked", async (_event, date?: string) => {
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    return apiFetch(`/menu/cooked${query}`);
  });
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
  ipcMain.handle("stock-supply:get-all", async (_event, departmentId?: string) => {
    const query = departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : "";
    return apiFetch(`/stock-supplies${query}`);
  });
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
  ipcMain.handle("stock-supply:get-count", async () => apiFetch("/stock-supplies/count"));
}

export function registerStockRequestHandlers() {
  ipcMain.handle("stock-request:get-all", async (_event, status?: string) => {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return apiFetch(`/stock-requests${query}`);
  });
  ipcMain.handle("stock-request:get-by-id", async (_event, id: string) => apiFetch(`/stock-requests/${id}`));
  ipcMain.handle("stock-request:get-pending-count", async () => apiFetch("/stock-requests/pending-count"));
  ipcMain.handle("stock-request:get-partial-count", async () => apiFetch("/stock-requests/partial-count"));
  ipcMain.handle("stock-request:create", async (_event, data) =>
    apiFetch("/stock-requests", { method: "POST", body: JSON.stringify(data) })
  );
  ipcMain.handle("stock-request:fulfill", async (_event, id: string, data) =>
    apiFetch(`/stock-requests/${id}/fulfill`, { method: "PUT", body: JSON.stringify(data) })
  );
}

export function registerCategoryHandlers() {
  ipcMain.handle("category:get-all", async () => apiFetch("/categories"));
  ipcMain.handle("category:create", async (_event, data) =>
    apiFetch("/categories", { method: "POST", body: JSON.stringify(data) })
  );
  ipcMain.handle("category:update", async (_event, id: string, data) =>
    apiFetch(`/categories/${id}`, { method: "PUT", body: JSON.stringify(data) })
  );
  ipcMain.handle("category:delete", async (_event, id: string) =>
    apiFetch(`/categories/${id}`, { method: "DELETE" })
  );
}

export function registerStockSupplyExtraHandlers() {
  ipcMain.handle("stock-supply:get-low-stock-count", async () => apiFetch("/stock-supplies/low-stock-count"));
  ipcMain.handle("stock-supply:get-kitchen-inventory", async (_event, id: string) =>
    apiFetch(`/stock-supplies/${id}/kitchen-inventory`)
  );
  ipcMain.handle("stock-supply:get-all-with-department", async (_event, departmentId?: string) => {
    const query = departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : "";
    return apiFetch(`/stock-supplies${query}`);
  });
}

export function registerDepartmentHandlers() {
  ipcMain.handle("department:get-all", async () => apiFetch("/departments"));
  ipcMain.handle("department:get-by-id", async (_event, id: string) => apiFetch(`/departments/${id}`));
  ipcMain.handle("department:create", async (_event, data) =>
    apiFetch("/departments", { method: "POST", body: JSON.stringify(data) })
  );
  ipcMain.handle("department:update", async (_event, id: string, data) =>
    apiFetch(`/departments/${id}`, { method: "PUT", body: JSON.stringify(data) })
  );
  ipcMain.handle("department:delete", async (_event, id: string) =>
    apiFetch(`/departments/${id}`, { method: "DELETE" })
  );
}

export function registerCookingRecordHandlers() {
  ipcMain.handle("cooking-record:get-all", async (_event, stockSupplyId?: string) => {
    const query = stockSupplyId ? `?stockSupplyId=${encodeURIComponent(stockSupplyId)}` : "";
    return apiFetch(`/cooking-records${query}`);
  });
  ipcMain.handle("cooking-record:get-by-id", async (_event, id: string) => apiFetch(`/cooking-records/${id}`));
  ipcMain.handle("cooking-record:create", async (_event, data) =>
    apiFetch("/cooking-records", { method: "POST", body: JSON.stringify(data) })
  );
  ipcMain.handle("cooking-record:delete", async (_event, id: string) =>
    apiFetch(`/cooking-records/${id}`, { method: "DELETE" })
  );
}

export function registerKitchenConfigHandlers() {
  ipcMain.handle("kitchen-config:get", async () => apiFetch("/kitchen-config"));
  ipcMain.handle("kitchen-config:save", async (_event, id: string, data) =>
    apiFetch(`/kitchen-config/${id}`, { method: "PUT", body: JSON.stringify(data) })
  );
}

export function registerOrderHandlers() {
  ipcMain.handle("order:create", async (_event, data) =>
    apiFetch("/orders", { method: "POST", body: JSON.stringify(data) })
  );
}

export function registerUserHandlers() {
  ipcMain.handle("user:get-all", async () => apiFetch("/users"));
  ipcMain.handle("user:create", async (_event, data) =>
    apiFetch("/users", { method: "POST", body: JSON.stringify(data) })
  );
  ipcMain.handle("user:update", async (_event, id: string, data) =>
    apiFetch(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) })
  );
  ipcMain.handle("user:delete", async (_event, id: string) =>
    apiFetch(`/users/${id}`, { method: "DELETE" })
  );
}

export function registerMenuExtraHandlers() {
  ipcMain.handle("menu:get-stock-status", async (_event, mealType?: string) => {
    const query = mealType ? `?mealType=${encodeURIComponent(mealType)}` : "";
    return apiFetch(`/menu/stock-status${query}`);
  });
  ipcMain.handle("menu:update-availability", async (_event, id: string, data) =>
    apiFetch(`/menu/${id}/availability`, { method: "PUT", body: JSON.stringify(data) })
  );
  ipcMain.handle("menu:list-accompaniment-images", async () => apiFetch("/accompaniments/images"));
}

export function registerAccompanimentHandlers() {
  ipcMain.handle("accompaniment:get-all", async () => apiFetch("/accompaniments"));
  ipcMain.handle("accompaniment:create", async (_event, data) =>
    apiFetch("/accompaniments", { method: "POST", body: JSON.stringify(data) })
  );
  ipcMain.handle("accompaniment:update", async (_event, id: string, data) =>
    apiFetch(`/accompaniments/${id}`, { method: "PUT", body: JSON.stringify(data) })
  );
}

export function registerKitchenExtraHandlers() {
  ipcMain.handle("kitchen:get-inventory-list", async () => apiFetch("/kitchen/inventory"));
  ipcMain.handle("cooking-record:get-underproduced-count", async () =>
    apiFetch("/cooking-records/underproduced-count")
  );
}

export function registerStockLowHandlers() {
  ipcMain.handle("stock-supply:get-low-stock", async () => apiFetch("/stock-supplies/low-stock"));
}

export function registerOrderListHandlers() {
  ipcMain.handle("order:get-all", async (_event, orderNumber?: number) => {
    const query = orderNumber !== undefined ? `?orderNumber=${encodeURIComponent(orderNumber)}` : "";
    return apiFetch(`/orders${query}`);
  });
  ipcMain.handle("order:get-count", async () => apiFetch("/orders/count"));
  ipcMain.handle("order:void", async (_event, orderId: string, data) =>
    apiFetch(`/orders/${orderId}/void`, { method: "POST", body: JSON.stringify(data) })
  );
  ipcMain.handle("order:update-payment", async (_event, orderId: string, data) =>
    apiFetch(`/orders/${orderId}/payment`, { method: "PATCH", body: JSON.stringify(data) })
  );
  ipcMain.handle("order:mark-unpaid", async (_event, orderId: string, data) =>
    apiFetch(`/orders/${orderId}/unpaid-ack`, { method: "POST", body: JSON.stringify(data) })
  );
  ipcMain.handle("order:unmark-unpaid", async (_event, orderId: string) =>
    apiFetch(`/orders/${orderId}/unpaid-ack-undo`, { method: "POST" })
  );
}

export function registerShiftHandlers() {
  ipcMain.handle("shift:get-current", async () => apiFetch("/shifts/current"));
  ipcMain.handle("shift:get-to-close", async () => apiFetch("/shifts/to-close"));
  ipcMain.handle("shift:get", async (_event, shiftId: string) => apiFetch(`/shifts/${shiftId}`));
  ipcMain.handle("shift:list", async (_event, operationDay?: string) => {
    const query = operationDay ? `?date=${encodeURIComponent(operationDay)}` : "";
    return apiFetch(`/shifts${query}`);
  });
  ipcMain.handle("shift:list-by-range", async (_event, type: string, from: string, to: string) => {
    const query = `?type=${encodeURIComponent(type)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    return apiFetch(`/shifts${query}`);
  });
  ipcMain.handle("shift:close", async (_event, shiftId: string, data) =>
    apiFetch(`/shifts/${shiftId}/close`, { method: "POST", body: JSON.stringify(data) })
  );
  ipcMain.handle("shift:auto-close", async () =>
    apiFetch("/shifts/auto-close", { method: "POST" })
  );
}

export function registerReportHandlers() {
  ipcMain.handle("shift-report:get", async (_event, shiftId: string) => apiFetch(`/reports/shift/${shiftId}`));
  ipcMain.handle("report:stock-remaining", async () => apiFetch("/stock/remaining"));
  ipcMain.handle("report:void", async (_event, date: string) =>
    apiFetch(`/reports/voids?date=${encodeURIComponent(date)}`)
  );
}

export function registerShiftConfigHandlers() {
  ipcMain.handle("shift-config:get-all", async () => apiFetch("/shift-config"));
  ipcMain.handle("shift-config:create", async (_event, data) =>
    apiFetch("/shift-config", { method: "POST", body: JSON.stringify(data) })
  );
  ipcMain.handle("shift-config:update", async (_event, id: string, data) =>
    apiFetch(`/shift-config/${id}`, { method: "PUT", body: JSON.stringify(data) })
  );
  ipcMain.handle("shift-config:delete", async (_event, id: string) =>
    apiFetch(`/shift-config/${id}`, { method: "DELETE" })
  );
}
