export interface ReceiptAccompaniment {
  name: string;
  charged: boolean;
  price: number;
}

export interface ReceiptItem {
  name: string;
  accompaniments: ReceiptAccompaniment[];
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ReceiptOrderInfo {
  id: string;
  number: number;
  mealType: string;
  createdAt: string;
  paymentMethod: string;
  replacesOrderNumber?: number;
}

export interface ReceiptTotals {
  itemsPrice: number;
  shippingPrice: number;
  taxPrice: number;
  totalPrice: number;
}

export interface ReceiptData {
  ticket: "customer" | "kitchen" | "bar";
  order: ReceiptOrderInfo;
  restaurant: {
    name: string;
    branch?: string;
    address?: string;
    city?: string;
    phone?: string;
    tel?: string;
    poweredBy?: string;
    services?: string;
  };
  waiter: { name: string };
  items: ReceiptItem[];
  totals: ReceiptTotals;
  barcode: string;
}

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

function documentHtml(body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Receipt</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  body {
    margin: 0 auto;
    padding: 0;
    width: 72mm;
    box-sizing: border-box;
    font-family:'Courier New',Courier,monospace;
    font-size:12px;
    line-height:1.35;
    color:#000;
  }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function divider(): string {
  return `<div style="border-top:1px dashed #000; margin:5px 0;"></div>`;
}

function row(left: string, right: string, leftStyle = "", rightStyle = ""): string {
  return `<div style="display:flex; justify-content:space-between; gap:8px; align-items:baseline;">
    <span style="${leftStyle}">${left}</span><span style="${rightStyle}">${right}</span>
  </div>`;
}

function blockCenter(text: string, style = ""): string {
  return `<div style="text-align:center; ${style}">${text}</div>`;
}

function accompHtml(accompaniments: ReceiptAccompaniment[]): string {
  if (accompaniments.length === 0) return "";
  const lines = accompaniments
    .map((a) => {
      const tag = a.charged ? `+${money(a.price)}` : "FREE";
      return `<div style="padding-left:10px; font-size:11px;">&bull; ${a.name} (${tag})</div>`;
    })
    .join("");
  return `<div style="margin-top:1px;">${lines}</div>`;
}

function itemLinesHtml(data: ReceiptData): string {
  const header = `<div style="display:flex; gap:4px; font-weight:bold; border-bottom:1px dashed #000; padding-bottom:2px; margin-bottom:3px;">
    <span style="width:12%;">QTY</span><span style="flex:1;">ITEM</span><span style="width:23%; text-align:right;">PRICE</span><span style="width:23%; text-align:right;">TOTAL</span>
  </div>`;
  const rows = data.items
    .map((item) => {
      return `
    <div style="margin-bottom:6px;">
      <div style="display:flex; gap:4px;">
        <span style="width:12%; font-weight:bold;">${item.qty}</span>
        <span style="flex:1;">${item.name}</span>
        <span style="width:23%; text-align:right;">${money(item.unitPrice)}</span>
        <span style="width:23%; text-align:right; font-weight:bold;">${money(item.lineTotal)}</span>
      </div>
      ${accompHtml(item.accompaniments)}
    </div>`;
    })
    .join("");
  return `${header}${rows}`;
}

function customerBody(data: ReceiptData): string {
  return `
  ${blockCenter(`<span style="font-size:17px; font-weight:bold;">${data.restaurant.name}</span>`)}
  ${data.restaurant.branch ? blockCenter(`Branch: ${data.restaurant.branch}`, "font-size:11px; font-weight:bold;") : ""}
  ${data.restaurant.address ? blockCenter(data.restaurant.address, "font-size:11px;") : ""}
  ${data.restaurant.city ? blockCenter(data.restaurant.city, "font-size:11px;") : ""}
  ${divider()}
  ${row("Order #", String(data.order.number), "font-weight:bold;", "font-weight:bold;")}
  ${data.order.replacesOrderNumber != null ? blockCenter(`** REPLACES ORDER #${data.order.replacesOrderNumber} **`, "font-weight:bold; margin-top:2px;") : ""}
  ${row("Waiter", data.waiter.name)}
  ${row("Date", formatDate(data.order.createdAt))}
  ${row("Meal", data.order.mealType)}
  ${divider()}
  ${itemLinesHtml(data)}
  ${divider()}
  ${row("Sub-Total", money(data.totals.itemsPrice), "font-weight:bold;", "font-weight:bold;")}
  ${row("Shipping", money(data.totals.shippingPrice))}
  ${row("Tax", money(data.totals.taxPrice))}
  ${row("Total", money(data.totals.totalPrice), "font-weight:bold;", "font-weight:bold; font-size:15px;")}
  ${divider()}
  ${blockCenter("Thank you. Welcome Again 😊", "font-weight:bold; margin-top:4px;")}
  ${blockCenter("Buy Goods Till No: 994296", "font-size:13px; font-weight:bold; margin-top:6px;")}
  ${divider()}
  ${blockCenter("POS Designed and Build By:", "font-size:11px; font-weight:bold; margin-top:4px;")}
  ${data.restaurant.poweredBy ? blockCenter(`<span style="font-weight:bold;">${data.restaurant.poweredBy}</span>`, "font-size:13px;") : ""}
  ${data.restaurant.tel ? blockCenter(`Tel: ${data.restaurant.tel}`, "font-size:11px;") : ""}
  ${data.restaurant.services ? blockCenter(data.restaurant.services, "font-size:11px;") : ""}`;
}

function stationBody(data: ReceiptData, label: string): string {
  return `
  ${blockCenter(label, "font-size:16px; font-weight:bold; letter-spacing:1px;")}
  ${divider()}
  ${row("Order #", String(data.order.number), "font-weight:bold; font-size:15px;", "font-weight:bold; font-size:15px;")}
  ${row("Meal", data.order.mealType, "font-weight:bold;")}
  ${row("Serving", formatDate(data.order.createdAt), "font-weight:bold;")}
  ${row("Waiter", data.waiter.name)}
  ${divider()}
  ${data.items
    .map((item) => {
      const accomp = item.accompaniments.map((a) => a.name).join(", ");
      return `
    <div style="margin-bottom:8px;">
      <div style="font-size:16px; font-weight:bold;">${item.qty} &times; ${item.name}</div>
      ${accomp ? `<div style="padding-left:10px; font-size:11px;">${accomp}</div>` : ""}
    </div>`;
    })
    .join("")}
  ${divider()}
  ${blockCenter("&mdash;", "margin-top:4px;")}`;
}

export function customerReceiptHtml(data: ReceiptData): string {
  return documentHtml(customerBody(data));
}

export function kitchenReceiptHtml(data: ReceiptData): string {
  return documentHtml(stationBody(data, "KITCHEN TICKET"));
}

export function barReceiptHtml(data: ReceiptData): string {
  return documentHtml(stationBody(data, "BAR TICKET"));
}

// ─── Shift Report ────────────────────────────────────────────────────────────

export interface ShiftReportData {
  restaurant: {
    name: string;
    branch?: string;
    address?: string;
    city?: string;
    poweredBy?: string;
    tel?: string;
    services?: string;
  };
  shift: {
    type: string;
    date: string;
    openingTime: string;
    autoCloseTime: string;
    actualCloseTime: string | null;
    openedBy: string;
    closedBy?: string;
  };
  summary: {
    totalOrders: number;
    voidedOrders: number;
  };
  revenue: {
    [mealType: string]: { orders: number; total: number } | number;
    total: number;
  };
  plateMovement: {
    menuName: string;
    openingPlates: number;
    platesCooked: number;
    platesSold: number;
    closingPlates: number | null;
    expectedClosing: number;
    variance: number;
  }[];
  production: {
    totalCost: number;
    totalSales: number;
    variance: number;
    profitMargin: string;
  };
  unassignedCarryOver?: {
    total: number;
    batches: {
      stockSupplyName: string;
      totalProduced: number;
      totalAssigned: number;
      unassigned: number;
    }[];
  };
}

function shiftReportBody(data: ShiftReportData): string {
  const r = data.restaurant;
  const s = data.shift;
  const revenueEntries = Object.entries(data.revenue).filter(
    ([k]) => k !== "total",
  ) as [string, { orders: number; total: number }][];

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
  };

  const fmtTime = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
  };

  const shiftLabel = s.type === "DAY" ? "DAY" : "NIGHT";

  return `
  ${blockCenter(`<span style="font-size:17px; font-weight:bold;">${r.name}</span>`)}
  ${r.branch ? blockCenter(`Branch: ${r.branch}`, "font-size:11px; font-weight:bold;") : ""}
  ${r.address ? blockCenter(r.address, "font-size:11px;") : ""}
  ${r.city ? blockCenter(r.city, "font-size:11px;") : ""}
  ${divider()}
  ${row("Shift", `${shiftLabel} · ${fmtDate(s.date)}`)}
  ${row("Opened", `${fmtTime(s.openingTime)} by ${s.openedBy}`)}
  ${row("Scheduled close", fmtTime(s.autoCloseTime))}
  ${row("Closed", `${fmtTime(s.actualCloseTime)}${s.closedBy ? ` by ${s.closedBy}` : ""}`)}
  ${divider()}
  ${blockCenter("REVENUE BY MEAL PERIOD", "font-weight:bold; font-size:13px;")}
  ${divider()}
  ${revenueEntries.map(([mealType, entry]) => row(`${mealType} (${entry.orders} orders)`, money(entry.total))).join("")}
  ${divider()}
  ${row("Total", money(data.revenue.total), "font-weight:bold;", "font-weight:bold; font-size:14px;")}
  ${divider()}
  ${blockCenter("PLATE MOVEMENT", "font-weight:bold; font-size:13px;")}
  ${divider()}
  ${data.plateMovement.length === 0 ? blockCenter("No snapshots recorded.") : ""}
  ${data.plateMovement.length > 0 ? `<pre style="margin:0; font-family:'Courier New',Courier,monospace; font-size:12px; line-height:1.5;">ITEM           OPEN  COOKED  SOLD   CLOSE
${"─".repeat(38)}
${data.plateMovement.map((p) =>
  `<b>${p.menuName.slice(0, 14).padEnd(14)}</b>${String(p.openingPlates).padStart(5)}${String(p.platesCooked).padStart(7)}${String(p.platesSold).padStart(6)}${String(p.closingPlates ?? "—").padStart(6)}`
).join("\n")}
OPEN = carry-forward closing plates from previous shift</pre>` : ""}
  ${data.plateMovement.length > 0 ? divider() : ""}
  ${data.unassignedCarryOver && data.unassignedCarryOver.total > 0 ? `${divider()}
  ${blockCenter("UNASSIGNED CARRY-OVER", "font-weight:bold; font-size:13px;")}
  ${divider()}
  ${data.unassignedCarryOver.batches.map((b) => row(b.stockSupplyName, `${b.unassigned} of ${b.totalProduced} produced`)).join("")}
  ${divider()}
  ${row("Total unassigned plates", String(data.unassignedCarryOver.total), "font-weight:bold;", "font-weight:bold;")}
  ${divider()}` : ""}
  ${blockCenter("PRODUCTION vs SALES", "font-weight:bold; font-size:13px;")}
  ${divider()}
  ${row("Production cost", money(data.production.totalCost))}
  ${row("Sales", money(data.production.totalSales))}
  ${row("Variance", money(data.production.variance), "font-weight:bold;", "font-weight:bold;")}
  ${row("Profit margin", data.production.profitMargin)}
  ${divider()}`;
}

export function shiftReportHtml(data: ShiftReportData): string {
  return documentHtml(shiftReportBody(data));
}
