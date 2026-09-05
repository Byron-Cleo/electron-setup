import electron = require("electron");

electron.contextBridge.exposeInMainWorld("electron", {
  subscribeStatistics: (callback: (statistics: any) => void) => callback({}),
  getStaticData: () => console.log("static"),
  app: {
    quit: () => electron.ipcRenderer.invoke("app:quit"),
  },
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
    listImages: () => electron.ipcRenderer.invoke("menu:list-images"),
    create: (data: any) => electron.ipcRenderer.invoke("menu:create", data),
    update: (id: string, data: any) =>
      electron.ipcRenderer.invoke("menu:update", id, data),
    delete: (id: string) => electron.ipcRenderer.invoke("menu:delete", id),
    getRunningLowCount: () =>
      electron.ipcRenderer.invoke("menu:get-running-low-count"),
    getCookedMenus: (date?: string) =>
      electron.ipcRenderer.invoke("menu:get-cooked", date),
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
    getLowStock: () => electron.ipcRenderer.invoke("stock-supply:get-low-stock"),
  },
  stockRequest: {
    getAll: (status?: string) => electron.ipcRenderer.invoke("stock-request:get-all", status),
    getById: (id: string) => electron.ipcRenderer.invoke("stock-request:get-by-id", id),
    getPendingCount: () => electron.ipcRenderer.invoke("stock-request:get-pending-count"),
    getPartialCount: () => electron.ipcRenderer.invoke("stock-request:get-partial-count"),
    create: (data: any) => electron.ipcRenderer.invoke("stock-request:create", data),
    fulfill: (id: string, data: any) => electron.ipcRenderer.invoke("stock-request:fulfill", id, data),
  },
  category: {
    getAll: () => electron.ipcRenderer.invoke("category:get-all"),
    create: (data: any) => electron.ipcRenderer.invoke("category:create", data),
    update: (id: string, data: any) => electron.ipcRenderer.invoke("category:update", id, data),
    delete: (id: string) => electron.ipcRenderer.invoke("category:delete", id),
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
    getById: (id: string) => electron.ipcRenderer.invoke("cooking-record:get-by-id", id),
    create: (data: any) => electron.ipcRenderer.invoke("cooking-record:create", data),
    delete: (id: string) => electron.ipcRenderer.invoke("cooking-record:delete", id),
  },
  kitchen: {
    getConfig: () => electron.ipcRenderer.invoke("kitchen-config:get"),
    saveConfig: (id: string, data: any) =>
      electron.ipcRenderer.invoke("kitchen-config:save", id, data),
    getInventoryList: () => electron.ipcRenderer.invoke("kitchen:get-inventory-list"),
    getUnderproducedCount: () => electron.ipcRenderer.invoke("cooking-record:get-underproduced-count"),
  },
  printer: {
    getConfig: () => electron.ipcRenderer.invoke("printer:get-config"),
    saveConfig: (config: any) =>
      electron.ipcRenderer.invoke("printer:save-config", config),
    listDevices: () => electron.ipcRenderer.invoke("printer:list-devices"),
    checkStatus: (printer: any) =>
      electron.ipcRenderer.invoke("printer:check-status", printer),
    test: (printer: any) => electron.ipcRenderer.invoke("printer:test-print", printer),
  },
  serverConfig: {
    getConfig: () => electron.ipcRenderer.invoke("server-config:get"),
    saveConfig: (config: any) =>
      electron.ipcRenderer.invoke("server-config:save", config),
    test: () => electron.ipcRenderer.invoke("server-config:test"),
    getApiBase: () => electron.ipcRenderer.invoke("server-config:get-api-base"),
    getApiOrigin: () => electron.ipcRenderer.invoke("server-config:get-api-origin"),
  },
  order: {
    create: (data: any) => electron.ipcRenderer.invoke("order:create", data),
    getAll: (orderNumber?: number) => electron.ipcRenderer.invoke("order:get-all", orderNumber),
    getCount: () => electron.ipcRenderer.invoke("order:get-count"),
    void: (orderId: string, data: any) => electron.ipcRenderer.invoke("order:void", orderId, data),
    updatePayment: (orderId: string, data: any) =>
      electron.ipcRenderer.invoke("order:update-payment", orderId, data),
    markUnpaid: (orderId: string, data: any) =>
      electron.ipcRenderer.invoke("order:mark-unpaid", orderId, data),
    unmarkUnpaid: (orderId: string) => electron.ipcRenderer.invoke("order:unmark-unpaid", orderId),
  },
  users: {
    getAll: () => electron.ipcRenderer.invoke("user:get-all"),
    create: (data: any) => electron.ipcRenderer.invoke("user:create", data),
    update: (id: string, data: any) => electron.ipcRenderer.invoke("user:update", id, data),
    delete: (id: string) => electron.ipcRenderer.invoke("user:delete", id),
  },
  print: {
    preview: (data: any) => electron.ipcRenderer.invoke("printer:preview", data),
    receipt: (data: any) => electron.ipcRenderer.invoke("printer:print-receipt", data),
    previewShiftReport: (data: any) => electron.ipcRenderer.invoke("printer:preview-shift-report", data),
    printShiftReport: (data: any) => electron.ipcRenderer.invoke("printer:print-shift-report", data),
  },
  menuExtra: {
    getStockStatus: (mealType?: string) => electron.ipcRenderer.invoke("menu:get-stock-status", mealType),
    updateAvailability: (id: string, isAvailable: boolean) =>
      electron.ipcRenderer.invoke("menu:update-availability", id, { isAvailable }),
    getAccompanimentImages: () => electron.ipcRenderer.invoke("menu:list-accompaniment-images"),
  },
  accompaniment: {
    getAll: () => electron.ipcRenderer.invoke("accompaniment:get-all"),
    create: (data: any) => electron.ipcRenderer.invoke("accompaniment:create", data),
    update: (id: string, data: any) => electron.ipcRenderer.invoke("accompaniment:update", id, data),
  },
  shift: {
    getCurrent: () => electron.ipcRenderer.invoke("shift:get-current"),
    getToClose: () => electron.ipcRenderer.invoke("shift:get-to-close"),
    get: (shiftId: string) => electron.ipcRenderer.invoke("shift:get", shiftId),
    list: (operationDay?: string) => electron.ipcRenderer.invoke("shift:list", operationDay),
    listByRange: (type: string, from: string, to: string) =>
      electron.ipcRenderer.invoke("shift:list-by-range", type, from, to),
    close: (shiftId: string, data: any) => electron.ipcRenderer.invoke("shift:close", shiftId, data),
    autoClose: () => electron.ipcRenderer.invoke("shift:auto-close"),
  },
  report: {
    getShiftReport: (shiftId: string) => electron.ipcRenderer.invoke("shift-report:get", shiftId),
    getStockRemaining: () => electron.ipcRenderer.invoke("report:stock-remaining"),
    getVoidReport: (date: string) => electron.ipcRenderer.invoke("report:void", date),
  },
  shiftConfig: {
    getAll: () => electron.ipcRenderer.invoke("shift-config:get-all"),
    create: (data: any) => electron.ipcRenderer.invoke("shift-config:create", data),
    update: (id: string, data: any) => electron.ipcRenderer.invoke("shift-config:update", id, data),
    delete: (id: string) => electron.ipcRenderer.invoke("shift-config:delete", id),
  },
});
