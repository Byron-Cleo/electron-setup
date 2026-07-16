# Stock Management System — Phase 5: Electron IPC

## Platform

frontend

## Status

Not Started

## Goals

- Add IPC methods for all new backend routes
- Register IPC handlers in ipc-handlers.ts
- Expose methods via preload.cts
- Add TypeScript declarations in main.ts

## Notes

- Follow existing IPC patterns (contextBridge + ipcMain.handle)
- Proxy to Express routes via fetch()
- Full implementation plan in @context/project-plan/stock-management-system.md

## IPC Methods to Add

### 1. desktop/electron/preload.cts (Modify)

**Current state:** Exposes methods for existing features (mealType, menu, auth, etc.)

**Add to window.electron:**

```typescript
// Department methods
department: {
  getAll: () => ipcRenderer.invoke("department:getAll"),
  create: (data: CreateDepartmentData) => ipcRenderer.invoke("department:create", data),
  update: (id: string, data: UpdateDepartmentData) => ipcRenderer.invoke("department:update", id, data),
  delete: (id: string) => ipcRenderer.invoke("department:delete", id),
}

// Cooking Record methods
cookingRecord: {
  getAll: (stockSupplyId?: string) => ipcRenderer.invoke("cookingRecord:getAll", stockSupplyId),
  create: (data: CreateCookingRecordData) => ipcRenderer.invoke("cookingRecord:create", data),
  delete: (id: string) => ipcRenderer.invoke("cookingRecord:delete", id),
}

// Kitchen Inventory
kitchen: {
  getInventory: (stockSupplyId: string) => ipcRenderer.invoke("kitchen:getInventory", stockSupplyId),
  getConfig: () => ipcRenderer.invoke("kitchen:getConfig"),
  saveConfig: (data: KitchenConfigData) => ipcRenderer.invoke("kitchen:saveConfig", data),
}

// Low Stock Count
stockSupply: {
  // ... existing methods ...
  getLowStockCount: () => ipcRenderer.invoke("stockSupply:getLowStockCount"),
}
```

### 2. desktop/electron/ipc-handlers.ts (Modify)

**Current state:** Has handlers for existing features.

**Add handlers:**

```typescript
// Department handlers
ipcMain.handle("department:getAll", async () => {
  return fetch(`${API_BASE}/departments`).then(res => res.json())
})

ipcMain.handle("department:create", async (_event, data) => {
  return fetch(`${API_BASE}/departments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then(res => res.json())
})

ipcMain.handle("department:update", async (_event, id, data) => {
  return fetch(`${API_BASE}/departments/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then(res => res.json())
})

ipcMain.handle("department:delete", async (_event, id) => {
  return fetch(`${API_BASE}/departments/${id}`, {
    method: "DELETE",
  }).then(res => res.json())
})

// Cooking Record handlers
ipcMain.handle("cookingRecord:getAll", async (_event, stockSupplyId) => {
  const params = stockSupplyId ? `?stockSupplyId=${stockSupplyId}` : ""
  return fetch(`${API_BASE}/cooking-records${params}`).then(res => res.json())
})

ipcMain.handle("cookingRecord:create", async (_event, data) => {
  return fetch(`${API_BASE}/cooking-records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then(res => res.json())
})

ipcMain.handle("cookingRecord:delete", async (_event, id) => {
  return fetch(`${API_BASE}/cooking-records/${id}`, {
    method: "DELETE",
  }).then(res => res.json())
})

// Kitchen handlers
ipcMain.handle("kitchen:getInventory", async (_event, stockSupplyId) => {
  return fetch(`${API_BASE}/stock-supplies/${stockSupplyId}/kitchen-inventory`).then(res => res.json())
})

ipcMain.handle("kitchen:getConfig", async () => {
  return fetch(`${API_BASE}/kitchen-config`).then(res => res.json())
})

ipcMain.handle("kitchen:saveConfig", async (_event, data) => {
  return fetch(`${API_BASE}/kitchen-config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then(res => res.json())
})

// Low Stock Count handler
ipcMain.handle("stockSupply:getLowStockCount", async () => {
  return fetch(`${API_BASE}/stock-supplies/low-stock-count`).then(res => res.json())
})
```

### 3. desktop/electron/main.ts (Modify)

**Current state:** Registers IPC handlers on app ready.

**Changes:** No changes needed — handlers in ipc-handlers.ts are auto-registered.

## TypeScript Declarations (Optional)

### 4. desktop/ui/types/electron.d.ts (Modify — if needed)

**Add to ElectronAPI interface:**

```typescript
interface ElectronAPI {
  // ... existing methods ...
  
  department: {
    getAll: () => Promise<Department[]>
    create: (data: CreateDepartmentData) => Promise<Department>
    update: (id: string, data: UpdateDepartmentData) => Promise<Department>
    delete: (id: string) => Promise<void>
  }
  
  cookingRecord: {
    getAll: (stockSupplyId?: string) => Promise<CookingRecord[]>
    create: (data: CreateCookingRecordData) => Promise<CookingRecord>
    delete: (id: string) => Promise<void>
  }
  
  kitchen: {
    getInventory: (stockSupplyId: string) => Promise<KitchenInventory>
    getConfig: () => Promise<KitchenConfigData[]>
    saveConfig: (data: KitchenConfigData) => Promise<void>
  }
  
  stockSupply: {
    // ... existing methods ...
    getLowStockCount: () => Promise<{ count: number }>
  }
}
```

## Files to Modify

| File | Action |
|------|--------|
| desktop/electron/preload.cts | Modify — Add new method namespaces |
| desktop/electron/ipc-handlers.ts | Modify — Add new IPC handlers |
| desktop/ui/types/electron.d.ts | Modify — Update ElectronAPI interface |

## Testing Checklist

- [ ] Preload exposes all new methods
- [ ] IPC handlers proxy to Express routes correctly
- [ ] TypeScript types compile without errors
- [ ] Test department CRUD via Electron
- [ ] Test cooking record CRUD via Electron
- [ ] Test kitchen inventory via Electron
- [ ] Test low stock count via Electron
- [ ] Verify error handling works
