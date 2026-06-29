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
    create: (data: any) => electron.ipcRenderer.invoke("menu:create", data),
    update: (id: string, data: any) =>
      electron.ipcRenderer.invoke("menu:update", id, data),
    delete: (id: string) => electron.ipcRenderer.invoke("menu:delete", id),
  },
  auth: {
    login: (pin: string) => electron.ipcRenderer.invoke("auth:login", pin),
    logout: () => electron.ipcRenderer.invoke("auth:logout"),
  },
});
