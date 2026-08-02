import { BrowserWindow, ipcMain } from "electron";
import { findPrinterByRole } from "./printers.ts";
import { customerReceiptHtml, kitchenReceiptHtml, barReceiptHtml, type ReceiptData } from "./receiptTemplate.ts";

export interface PrintResult {
  ok: boolean;
  error?: string;
}

function templateFor(data: ReceiptData): (d: ReceiptData) => string {
  if (data.ticket === "kitchen") return kitchenReceiptHtml;
  if (data.ticket === "bar") return barReceiptHtml;
  return customerReceiptHtml;
}

function printHtml(deviceName: string, html: string): Promise<PrintResult> {
  const dataUrl = `data:text/html;base64,${Buffer.from(html, "utf-8").toString("base64")}`;

  return new Promise<PrintResult>((resolve) => {
    let settled = false;
    const finish = (result: PrintResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const closeWin = () => {
      if (!win.isDestroyed()) win.close();
    };

    win.webContents.on("did-finish-load", () => {
      win.webContents.print(
        { silent: true, deviceName },
        (success: boolean, failureReason?: string) => {
          finish(success ? { ok: true } : { ok: false, error: failureReason ?? "Print failed" });
          closeWin();
        },
      );
    });

    win.webContents.on("did-fail-load", (_event, code, desc) => {
      finish({ ok: false, error: `Receipt page failed to load (${code}: ${desc})` });
      closeWin();
    });

    win.loadURL(dataUrl).catch((err: Error) => {
      finish({ ok: false, error: err.message });
      closeWin();
    });
  });
}

export function registerReceiptHandlers(): void {
  ipcMain.handle("printer:print-receipt", async (_event, data: ReceiptData): Promise<PrintResult> => {
    const printer = findPrinterByRole("customer");
    if (!printer?.deviceName) {
      return { ok: false, error: "No customer printer configured" };
    }
    const html = templateFor(data)(data);
    return printHtml(printer.deviceName, html);
  });
}
