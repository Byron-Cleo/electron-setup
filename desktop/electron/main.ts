import pkg from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { isDev } from "./utils.ts";
const { app, BrowserWindow } = pkg;
import { pollResources } from "./resourceManager.ts";
import { getPreloadPath } from "./pathResolver.ts";

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
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    center: true,
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

  pollResources();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const win = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: getPreloadPath(),
      },
    });
    if (isDev()) {
      win.loadURL("http://localhost:5123");
    } else {
      win.loadFile(appPath + "/dist-react/index.html");
    }
  }
});
