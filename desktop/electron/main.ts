import pkg from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { isDev } from "./utils.ts";
const { app, BrowserWindow } = pkg;
import { getPreloadPath } from "./pathResolver.ts";
import { registerMealTypeHandlers, registerMenuHandlers } from "./ipc-handlers.ts";

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

app.whenReady().then(() => {
  registerMealTypeHandlers();
  registerMenuHandlers();
  const win = new BrowserWindow({
    show: false,
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
    win.maximize();
    win.show();
    win.focus();
  });

});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const win = new BrowserWindow({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: getPreloadPath(),
      },
    });
    win.maximize();
    if (isDev()) {
      win.loadURL("http://localhost:5123");
    } else {
      win.loadFile(appPath + "/dist-react/index.html");
    }
  }
});
