import electron = require("electron");

electron.contextBridge.exposeInMainWorld("electron", {
  subscribeStatistics: (callback: (statistics: any) => void) => callback({}),
  getStaticData: () => console.log("static"),
  mealType: {
    getAll: () => electron.ipcRenderer.invoke("meal-type:get-all"),
    getById: (id: string) => electron.ipcRenderer.invoke("meal-type:get-by-id", id),
    create: (data: { name: string; sortOrder?: number }) =>
      electron.ipcRenderer.invoke("meal-type:create", data),
    update: (id: string, data: { name?: string; sortOrder?: number }) =>
      electron.ipcRenderer.invoke("meal-type:update", id, data),
    delete: (id: string) => electron.ipcRenderer.invoke("meal-type:delete", id),
  },
  menu: {
    getAll: () => electron.ipcRenderer.invoke("menu:get-all"),
    getById: (id: string) => electron.ipcRenderer.invoke("menu:get-by-id", id),
    getByMealType: (mealType: string) => electron.ipcRenderer.invoke("menu:get-by-meal-type", mealType),
    create: (data: any) => electron.ipcRenderer.invoke("menu:create", data),
    update: (id: string, data: any) =>
      electron.ipcRenderer.invoke("menu:update", id, data),
    delete: (id: string) => electron.ipcRenderer.invoke("menu:delete", id),
  },
  auth: {
    login: (pin: string) => electron.ipcRenderer.invoke("auth:login", pin),
    logout: () => electron.ipcRenderer.invoke("auth:logout"),
  },
  stockSupplyCategory: {
    getAll: () => electron.ipcRenderer.invoke("stock-supply-category:get-all"),
    getById: (id: string) => electron.ipcRenderer.invoke("stock-supply-category:get-by-id", id),
    create: (data: { name: string; description?: string }) =>
      electron.ipcRenderer.invoke("stock-supply-category:create", data),
    update: (id: string, data: { name?: string; description?: string }) =>
      electron.ipcRenderer.invoke("stock-supply-category:update", id, data),
    delete: (id: string) => electron.ipcRenderer.invoke("stock-supply-category:delete", id),
  },
  stockSupply: {
    getAll: (departmentId?: string) => electron.ipcRenderer.invoke("stock-supply:get-all", departmentId),
    getById: (id: string) => electron.ipcRenderer.invoke("stock-supply:get-by-id", id),
    create: (data: any) => electron.ipcRenderer.invoke("stock-supply:create", data),
    update: (id: string, data: any) =>
      electron.ipcRenderer.invoke("stock-supply:update", id, data),
    delete: (id: string) => electron.ipcRenderer.invoke("stock-supply:delete", id),
    getLowStockCount: () => electron.ipcRenderer.invoke("stock-supply:get-low-stock-count"),
    getStockCount: () => electron.ipcRenderer.invoke("stock-supply:get-count"),
    getKitchenInventory: (id: string) => electron.ipcRenderer.invoke("stock-supply:get-kitchen-inventory", id),
  },
  stockRequest: {
    getAll: (status?: string) => electron.ipcRenderer.invoke("stock-request:get-all", status),
    getById: (id: string) => electron.ipcRenderer.invoke("stock-request:get-by-id", id),
    create: (data: any) => electron.ipcRenderer.invoke("stock-request:create", data),
    fulfill: (id: string, data: any) => electron.ipcRenderer.invoke("stock-request:fulfill", id, data),
  },
  department: {
    getAll: () => electron.ipcRenderer.invoke("department:get-all"),
    getById: (id: string) => electron.ipcRenderer.invoke("department:get-by-id", id),
    create: (data: any) => electron.ipcRenderer.invoke("department:create", data),
    update: (id: string, data: any) =>
      electron.ipcRenderer.invoke("department:update", id, data),
    delete: (id: string) => electron.ipcRenderer.invoke("department:delete", id),
  },
  cookingRecord: {
    getAll: (stockSupplyId?: string) => electron.ipcRenderer.invoke("cooking-record:get-all", stockSupplyId),
    create: (data: any) => electron.ipcRenderer.invoke("cooking-record:create", data),
    delete: (id: string) => electron.ipcRenderer.invoke("cooking-record:delete", id),
  },
  kitchen: {
    getConfig: () => electron.ipcRenderer.invoke("kitchen-config:get"),
    saveConfig: (id: string, data: any) =>
      electron.ipcRenderer.invoke("kitchen-config:save", id, data),
  },
  printer: {
    getConfig: () => electron.ipcRenderer.invoke("printer:get-config"),
    saveConfig: (config: any) =>
      electron.ipcRenderer.invoke("printer:save-config", config),
    listDevices: () => electron.ipcRenderer.invoke("printer:list-devices"),
    checkStatus: (printer: any) =>
      electron.ipcRenderer.invoke("printer:check-status", printer),
  },
  serverConfig: {
    getConfig: () => electron.ipcRenderer.invoke("server-config:get"),
    saveConfig: (config: any) =>
      electron.ipcRenderer.invoke("server-config:save", config),
    test: () => electron.ipcRenderer.invoke("server-config:test"),
    getApiBase: () => electron.ipcRenderer.invoke("server-config:get-api-base"),
  },
  order: {
    create: (data: any) => electron.ipcRenderer.invoke("order:create", data),
  },
  print: {
    preview: (data: any) => electron.ipcRenderer.invoke("printer:preview", data),
    receipt: (data: any) => electron.ipcRenderer.invoke("printer:print-receipt", data),
  },
});
