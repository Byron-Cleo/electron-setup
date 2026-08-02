import { app, ipcMain, BrowserWindow } from "electron";
import fs from "fs";
import path from "path";
import net from "net";

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

export interface PrinterStatus {
  online: boolean | null;
  reason: string;
}

function probeLan(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

async function usbOnline(deviceName: string): Promise<boolean> {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  if (!win) return false;
  const printers = await win.webContents.getPrintersAsync();
  return printers.some((p) => p.name === deviceName);
}

export async function checkPrinterStatus(printer: PosPrinter): Promise<PrinterStatus> {
  if (printer.transport === "lan") {
    const host = printer.host ?? "";
    const port = printer.port ?? 9100;
    const online = host ? await probeLan(host, port) : false;
    return { online, reason: online ? "Reachable" : "Unreachable" };
  }
  const deviceName = printer.deviceName ?? "";
  const online = deviceName ? await usbOnline(deviceName) : false;
  return { online, reason: online ? "Detected" : "Not detected" };
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

export function findPrinterByRole(role: PosPrinterRole): PosPrinter | undefined {
  return readPrinters().printers.find((p) => p.role === role);
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
  ipcMain.handle("printer:check-status", async (_event, printer: PosPrinter) =>
    checkPrinterStatus(printer)
  );
}
