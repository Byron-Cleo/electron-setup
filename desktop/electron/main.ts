import pkg from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { isDev } from "./utils.ts";
const { app, BrowserWindow, ipcMain } = pkg;
import { getPreloadPath } from "./pathResolver.ts";
import { registerMealTypeHandlers, registerMenuHandlers, registerAuthHandlers, registerStockSupplyCategoryHandlers, registerStockSupplyHandlers, registerStockRequestHandlers, registerStockSupplyExtraHandlers, registerDepartmentHandlers, registerCookingRecordHandlers, registerKitchenConfigHandlers, registerOrderHandlers, registerUserHandlers, registerMenuExtraHandlers, registerAccompanimentHandlers, registerKitchenExtraHandlers, registerStockLowHandlers, registerOrderListHandlers, registerShiftHandlers, registerReportHandlers, registerShiftConfigHandlers, registerCategoryHandlers } from "./ipc-handlers.ts";
import { registerPrinterHandlers } from "./printers.ts";
import { registerReceiptHandlers } from "./receipt.ts";
import { registerServerConfigHandlers } from "./server-config.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appPath = app.getAppPath();

try {
  const { default: electronReload } = await import("electron-reload");
  electronReload(__dirname, {
    electron: path.join(__dirname, "node_modules", ".bin", "electron"),
    watched: ["**/*.{js,css,html}"],
  });
} catch {} // dev-only

function createMainWindow() {
  const win = new BrowserWindow({
    show: false,
    // Dev: normal window with native minimize/maximize/close so you can
    // switch between apps. Production: locked frameless kiosk (default).
    kiosk: !isDev(),
    frame: isDev(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: getPreloadPath(),
    },
  });

  if (isDev()) {
    win.loadURL("http://localhost:5123");
  } else {
    win.loadFile(path.join(appPath + "/dist-react/index.html"));
  }

  win.once("ready-to-show", () => {
    win.show();
    win.focus();
  });

  return win;
}

app.whenReady().then(() => {
  registerMealTypeHandlers();
  registerMenuHandlers();
  registerAuthHandlers();
  registerStockSupplyCategoryHandlers();
  registerStockSupplyHandlers();
  registerStockRequestHandlers();
  registerStockSupplyExtraHandlers();
  registerDepartmentHandlers();
  registerCookingRecordHandlers();
  registerCategoryHandlers();
  registerKitchenConfigHandlers();
  registerOrderHandlers();
  registerUserHandlers();
  registerMenuExtraHandlers();
  registerAccompanimentHandlers();
  registerKitchenExtraHandlers();
  registerStockLowHandlers();
  registerOrderListHandlers();
  registerShiftHandlers();
  registerReportHandlers();
  registerShiftConfigHandlers();
  registerPrinterHandlers();
  registerReceiptHandlers();
  registerServerConfigHandlers();

  ipcMain.handle("app:quit", () => {
    app.quit();
  });

  createMainWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
