import { app, ipcMain, BrowserWindow } from "electron";
import fs from "fs";
import path from "path";

export type PosPrinterTransport = "usb" | "lan";
export type PosPrinterRole = "customer" | "kitchen" | "bar";

export interface PosPrinter {
  id: string;
  name: string;
  transport: PosPrinterTransport;
  role: PosPrinterRole;
  deviceName?: string;
  host?: string;
  port?: number;
}

export interface PosPrinterConfig {
  printers: PosPrinter[];
}

const CONFIG_FILENAME = "printers.json";

const EMPTY_CONFIG: PosPrinterConfig = { printers: [] };

export function getPrintersPath(): string {
  return path.join(app.getPath("userData"), CONFIG_FILENAME);
}

export function readPrinters(): PosPrinterConfig {
  try {
    const raw = fs.readFileSync(getPrintersPath(), "utf-8");
    const parsed = JSON.parse(raw) as Partial<PosPrinterConfig>;
    if (!Array.isArray(parsed.printers)) return EMPTY_CONFIG;
    return { printers: parsed.printers as PosPrinter[] };
  } catch {
    return EMPTY_CONFIG;
  }
}

export function writePrinters(config: PosPrinterConfig): PosPrinterConfig {
  fs.writeFileSync(getPrintersPath(), JSON.stringify(config, null, 2), "utf-8");
  return config;
}

export function registerPrinterHandlers(): void {
  ipcMain.handle("printer:get-config", async () => readPrinters());
  ipcMain.handle("printer:save-config", async (_event, config: PosPrinterConfig) => {
    return writePrinters(config);
  });
  ipcMain.handle("printer:list-devices", async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    if (!win) return [];
    const printers = await win.webContents.getPrintersAsync();
    return printers.map((p) => p.name);
  });
}
