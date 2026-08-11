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
const ESC_BOLD_ON = Buffer.from([0x1b, 0x45, 0x01]); // ESC E 1 — bold on
const ESC_BOLD_OFF = Buffer.from([0x1b, 0x45, 0x00]); // ESC E 0 — bold off

type Seg = { t: string; b?: boolean };
type Line = Seg[];

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

function wrapWords(text: string, width: number): string[] {
  if (text.length <= width) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (candidate.length > width) {
      if (cur) lines.push(cur);
      cur = word;
    } else {
      cur = candidate;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Renders receipt lines as raw ESC/POS with bold segments (ESC E). Mirrors the
// HTML preview so the printed receipt keeps the same content, emphasis and no
// truncated words.
function renderEscPos(lines: Line[]): Buffer {
  const parts: Buffer[] = [];
  let bold = false;
  for (const line of lines) {
    for (const seg of line) {
      const want = seg.b ?? false;
      if (want !== bold) {
        parts.push(want ? ESC_BOLD_ON : ESC_BOLD_OFF);
        bold = want;
      }
      parts.push(Buffer.from(seg.t, "latin1"));
    }
    parts.push(Buffer.from("\n", "latin1"));
  }
  if (bold) parts.push(ESC_BOLD_OFF);
  return Buffer.concat(parts);
}

function plainTextLines(data: ReceiptData): Line[] {
  const r = data.restaurant;
  const width = 42;
  const line = "-".repeat(width);
  const lines: Line[] = [];
  const push = (text: string, b = false) => lines.push([{ t: text, b }]);
  const pushCenter = (text: string, b = false) => {
    for (const wrapped of wrapWords(text, width)) push(padCenter(wrapped, width), b);
  };
  const pushRow = (left: string, right: string, b = false) => {
    const pad = Math.max(1, width - left.length - right.length);
    const segs: Seg[] = [{ t: left, b }, { t: " ".repeat(pad) }, { t: right, b }];
    lines.push(segs);
  };

  pushCenter(r.name, true);
  if (r.branch) pushCenter(`Branch: ${r.branch}`, true);
  if (r.address) pushCenter(r.address);
  if (r.city) pushCenter(r.city);
  push(line);
  pushRow("Order #", String(data.order.number), true);
  pushRow("Waiter", data.waiter.name);
  pushRow("Date", formatDate(data.order.createdAt));
  pushRow("Meal", data.order.mealType);
  push(line);

  // Four-column item block mirroring the HTML preview (QTY | ITEM | PRICE | TOTAL).
  const qtyW = 4;
  const nameW = 14;
  const priceW = 12;
  const totalW = 12;
  const header =
    "QTY".padEnd(qtyW) + "ITEM".padEnd(nameW) + "PRICE".padStart(priceW) + "TOTAL".padStart(totalW);
  push(header, true);

  for (const item of data.items) {
    const qty = String(item.qty).padEnd(qtyW);
    const name = item.name;
    const price = money(item.unitPrice).padStart(priceW);
    const total = money(item.lineTotal).padStart(totalW);
    lines.push([
      { t: qty, b: true },
      { t: name.slice(0, nameW).padEnd(nameW) },
      { t: price },
      { t: total, b: true },
    ]);
    const overflow = name.slice(nameW).trim();
    if (overflow) {
      const contWidth = width - qtyW;
      for (const wrapped of wrapWords(overflow, contWidth)) {
        push(" ".repeat(qtyW) + wrapped);
      }
    }
    for (const acc of item.accompaniments) {
      const tag = acc.charged ? `(+${money(acc.price)})` : "(FREE)";
      for (const wrapped of wrapWords(`* ${acc.name} ${tag}`, width - qtyW)) {
        push(" ".repeat(qtyW) + wrapped);
      }
    }
  }
  push(line);
  pushRow("Sub-Total", money(data.totals.itemsPrice), true);
  pushRow("Shipping", money(data.totals.shippingPrice));
  pushRow("Tax", money(data.totals.taxPrice));
  pushRow("Total", money(data.totals.totalPrice), true);
  push(line);
  pushCenter("Thank You. Welcome Again", true);
  pushCenter("Buy Goods Till No: 994296", true);
  push(line);
  pushCenter("POS Designed and Build By:", true);
  if (r.poweredBy) pushCenter(r.poweredBy, true);
  if (r.tel) pushCenter(`Tel: ${r.tel}`);
  if (r.services) pushCenter(r.services);

  return lines;
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

function printToLan(printer: PosPrinter, payload: Buffer, timeoutMs = 5000): Promise<PrintResult> {
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
      const buffer = Buffer.concat([ESC_INIT, payload, ESC_FEED_4, GS_CUT]);
      socket.write(buffer, (err) => {
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

async function printRawUsb(printer: PosPrinter, payload: Buffer): Promise<PrintResult> {
  if (!printer.deviceName) return { ok: false, error: "USB printer has no device name configured" };
  const buffer = Buffer.concat([ESC_INIT, payload, ESC_FEED_4, GS_CUT]);

  const port = await getRawPort(printer.deviceName);
  const targets = [port && `\\\\localhost\\${port}`, `\\\\localhost\\${printer.deviceName}`].filter(
    (t): t is string => !!t,
  );
  for (const target of targets) {
    const result = await rawWriteToTarget(target, buffer);
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
    return printToLan(printer, renderEscPos(plainTextLines(data)));
  }
  if (!printer.deviceName) {
    return { ok: false, error: "USB printer has no device name configured" };
  }
  const raw = await printRawUsb(printer, renderEscPos(plainTextLines(data)));
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
      return printToLan(printer, Buffer.from(plainTextTest(printer.name), "latin1"));
    }
    if (!printer.deviceName) {
      return { ok: false, error: "USB printer has no device name configured" };
    }
    const raw = await printRawUsb(printer, Buffer.from(plainTextTest(printer.name), "latin1"));
    if (raw.ok) return raw;
    return printHtml(printer.deviceName, testHtml(printer.name));
  });
}
