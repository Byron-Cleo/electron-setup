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
    getAll: () => electron.ipcRenderer.invoke("stock-supply:get-all"),
    getById: (id: string) => electron.ipcRenderer.invoke("stock-supply:get-by-id", id),
    create: (data: any) => electron.ipcRenderer.invoke("stock-supply:create", data),
    update: (id: string, data: any) =>
      electron.ipcRenderer.invoke("stock-supply:update", id, data),
    delete: (id: string) => electron.ipcRenderer.invoke("stock-supply:delete", id),
  },
  stockRequest: {
    getAll: (status?: string) => electron.ipcRenderer.invoke("stock-request:get-all", status),
    getById: (id: string) => electron.ipcRenderer.invoke("stock-request:get-by-id", id),
    create: (data: any) => electron.ipcRenderer.invoke("stock-request:create", data),
    fulfill: (id: string, data: any) => electron.ipcRenderer.invoke("stock-request:fulfill", id, data),
  },
});
