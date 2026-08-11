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
