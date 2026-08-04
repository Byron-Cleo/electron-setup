import { BrowserWindow, ipcMain } from "electron";
import net from "net";
import fs from "fs";
import { execFile } from "child_process";
import { findPrinterByRole, type PosPrinter, type PosPrinterRole } from "./printers.ts";
import { customerReceiptHtml, kitchenReceiptHtml, barReceiptHtml, type ReceiptData } from "./receiptTemplate.ts";

export interface PrintResult {
  ok: boolean;
  error?: string;
}

// ─── ESC/POS helpers ─────────────────────────────────────────────────────────

const ESC_INIT = Buffer.from([0x1b, 0x40]); // ESC @
const ESC_FEED_4 = Buffer.from([0x1b, 0x64, 0x04]); // ESC d 4 — feed 4 lines
const GS_CUT = Buffer.from([0x1d, 0x56, 0x42, 0x00]); // GS V B 0 — full cut

function money(amount: number): string {
  return `KSH ${amount.toLocaleString("en-KE")}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-KE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function padCenter(text: string, width: number): string {
  const trimmed = text.length > width ? text.slice(0, width) : text;
  const pad = Math.max(0, width - trimmed.length);
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + trimmed;
}

function plainTextReceipt(data: ReceiptData): string {
  const r = data.restaurant;
  const width = 42;
  const line = "-".repeat(width);
  const out: string[] = [];

  out.push(padCenter(r.name, width));
  if (r.branch) out.push(padCenter(`Branch: ${r.branch}`, width));
  if (r.address) out.push(padCenter(r.address, width));
  if (r.phone) out.push(padCenter(r.phone, width));
  if (r.tel) out.push(`Tel: ${r.tel}`);
  out.push(line);
  out.push(`Order #${data.order.number}`);
  out.push(`Meal: ${data.order.mealType}`);
  out.push(`Date: ${formatDate(data.order.createdAt)}`);
  out.push(`Payment: ${data.order.paymentMethod}`);
  out.push(`Waiter: ${data.waiter.name}`);
  out.push(line);

  for (const item of data.items) {
    out.push(item.name);
    out.push(`  ${item.qty} x ${money(item.unitPrice)}  ${money(item.lineTotal)}`);
    for (const acc of item.accompaniments) {
      out.push(`    * ${acc.name}${acc.charged ? ` (+${money(acc.price)})` : " — FREE"}`);
    }
  }
  out.push(line);
  out.push(`Items: ${money(data.totals.itemsPrice)}`);
  out.push(`Shipping: ${money(data.totals.shippingPrice)}`);
  out.push(`Tax: ${money(data.totals.taxPrice)}`);
  out.push(`TOTAL: ${money(data.totals.totalPrice)}`);
  out.push(line);
  out.push(padCenter("Thank You! Visit Again", width));
  out.push(padCenter(`Order #${data.barcode}`, width));
  if (r.poweredBy) out.push(r.poweredBy);
  if (r.services) out.push(r.services);

  return out.join("\n") + "\n";
}

function plainTextTest(name: string): string {
  const width = 42;
  const line = "-".repeat(width);
  return [
    padCenter("TEST PRINT", width),
    padCenter(name, width),
    line,
    "If you can read this, your printer",
    "is configured correctly.",
    `Date: ${new Date().toLocaleString("en-KE")}`,
    line,
    padCenter("Test Complete", width),
  ].join("\n") + "\n";
}

function printToLan(printer: PosPrinter, text: string, timeoutMs = 5000): Promise<PrintResult> {
  const host = printer.host ?? "";
  const port = printer.port ?? 9100;

  return new Promise<PrintResult>((resolve) => {
    let settled = false;
    const finish = (result: PrintResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    const socket = net.createConnection({ host, port });
    socket.setTimeout(timeoutMs);

    socket.once("connect", () => {
      const payload = Buffer.concat([
        ESC_INIT,
        Buffer.from(text, "latin1"),
        ESC_FEED_4,
        GS_CUT,
      ]);
      socket.write(payload, (err) => {
        if (err) {
          finish({ ok: false, error: err.message });
        } else {
          finish({ ok: true });
        }
      });
    });

    socket.once("timeout", () => finish({ ok: false, error: "Timed out connecting to printer" }));
    socket.once("error", (err) => finish({ ok: false, error: err.message }));
  });
}

// Raw ESC/POS over USB (Windows) — bypasses the printer driver so the full
// receipt prints continuously with no page-size clipping.
function getRawPort(deviceName: string): Promise<string | null> {
  if (process.platform !== "win32") return Promise.resolve(null);
  const escaped = deviceName.replace(/'/g, "''");
  return new Promise((resolve) => {
    execFile(
      "powershell",
      ["-NoProfile", "-NoLogo", "-NonInteractive", "-Command", `(Get-Printer -Name '${escaped}').PortName`],
      { timeout: 8000, windowsHide: true },
      (err, stdout) => {
        if (err) return resolve(null);
        const port = stdout.trim();
        resolve(port ? port : null);
      },
    );
  });
}

function rawWriteToTarget(target: string, buffer: Buffer, timeoutMs = 10000): Promise<PrintResult> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: PrintResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        stream.destroy();
      } catch {
        /* ignore */
      }
      resolve(result);
    };

    const timer = setTimeout(
      () => finish({ ok: false, error: `Timed out sending to ${target}` }),
      timeoutMs,
    );

    const stream = fs.createWriteStream(target);
    stream.once("error", (err) =>
      finish({ ok: false, error: `Cannot reach ${target}: ${err.message}` }),
    );
    stream.once("open", () => {
      stream.write(buffer, (err) => {
        if (err) return finish({ ok: false, error: err.message });
        stream.end();
      });
    });
    stream.once("finish", () => finish({ ok: true }));
  });
}

async function printRawUsb(printer: PosPrinter, text: string): Promise<PrintResult> {
  if (!printer.deviceName) return { ok: false, error: "USB printer has no device name configured" };
  const payload = Buffer.concat([
    ESC_INIT,
    Buffer.from(text, "latin1"),
    ESC_FEED_4,
    GS_CUT,
  ]);

  const port = await getRawPort(printer.deviceName);
  const targets = [port && `\\\\localhost\\${port}`, `\\\\localhost\\${printer.deviceName}`].filter(
    (t): t is string => !!t,
  );
  for (const target of targets) {
    const result = await rawWriteToTarget(target, payload);
    if (result.ok) return result;
  }
  const portHint = port ? ` printer port ${port}` : "";
  return { ok: false, error: `Could not send raw data to the USB printer${portHint}` };
}

function testHtml(name: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: 80mm auto; margin: 0; }
      body {
        margin: 0 auto;
        padding: 0;
        width: 72mm;
        box-sizing: border-box;
        font-family: "Courier New", monospace;
        font-size: 12px;
        color: #000;
      }
      .center { text-align: center; }
      .line { border-top: 1px dashed #000; margin: 6px 0; }
    </style>
  </head>
  <body>
    <div class="center"><strong>TEST PRINT</strong></div>
    <div class="center">${name}</div>
    <div class="line"></div>
    <div>If you can read this, your printer is configured correctly.</div>
    <div>Date: ${new Date().toLocaleString("en-KE")}</div>
    <div class="line"></div>
    <div class="center"><strong>Test Complete</strong></div>
  </body>
</html>`;
}

// ─── HTML printing (USB / OS printers) ───────────────────────────────────────

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

    win.webContents.on("did-finish-load", async () => {
      let pageHeightMicrons = 297000;
      try {
        const heightPx = Number(
          await win.webContents.executeJavaScript("document.body.scrollHeight"),
        );
        if (Number.isFinite(heightPx) && heightPx > 0) {
          const heightMm = Math.ceil((heightPx / 96) * 25.4) + 20;
          pageHeightMicrons = Math.min(heightMm, 800) * 1000;
        }
      } catch {
        /* measurement failed — use default */
      }

      win.webContents.print(
        {
          silent: true,
          deviceName,
          margins: { marginType: "none" },
          pageSize: { width: 80000, height: pageHeightMicrons },
          printBackground: true,
        },
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

function roleForTicket(ticket: ReceiptData["ticket"]): PosPrinterRole {
  if (ticket === "kitchen") return "kitchen";
  if (ticket === "bar") return "bar";
  return "customer";
}

async function printReceipt(data: ReceiptData): Promise<PrintResult> {
  const printer = findPrinterByRole(roleForTicket(data.ticket));
  if (!printer) {
    return { ok: false, error: `No ${roleForTicket(data.ticket)} printer configured` };
  }
  if (printer.transport === "lan") {
    if (!printer.host) {
      return { ok: false, error: "LAN printer has no IP address configured" };
    }
    return printToLan(printer, plainTextReceipt(data));
  }
  if (!printer.deviceName) {
    return { ok: false, error: "USB printer has no device name configured" };
  }
  const raw = await printRawUsb(printer, plainTextReceipt(data));
  if (raw.ok) return raw;
  const html = templateFor(data)(data);
  return printHtml(printer.deviceName, html);
}

export function registerReceiptHandlers(): void {
  ipcMain.handle("printer:preview", async (_event, data: ReceiptData): Promise<string> => {
    return templateFor(data)(data);
  });

  ipcMain.handle("printer:print-receipt", async (_event, data: ReceiptData): Promise<PrintResult> => {
    return printReceipt(data);
  });

  ipcMain.handle("printer:test-print", async (_event, printer: PosPrinter): Promise<PrintResult> => {
    if (printer.transport === "lan") {
      if (!printer.host) return { ok: false, error: "LAN printer has no IP address configured" };
      return printToLan(printer, plainTextTest(printer.name));
    }
    if (!printer.deviceName) {
      return { ok: false, error: "USB printer has no device name configured" };
    }
    const raw = await printRawUsb(printer, plainTextTest(printer.name));
    if (raw.ok) return raw;
    return printHtml(printer.deviceName, testHtml(printer.name));
  });
}
