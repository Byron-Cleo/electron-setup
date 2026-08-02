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
  restaurant: { name: string; address?: string; phone?: string };
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
</head>
<body style="margin:0; padding:4mm; width:80mm; box-sizing:border-box; font-family:'Courier New',Courier,monospace; font-size:12px; line-height:1.35; color:#000;">
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
  return data.items
    .map((item) => {
      const qtyLine = `${item.qty} x ${money(item.unitPrice)}`;
      return `
    <div style="margin-bottom:6px;">
      ${row(item.name, money(item.lineTotal), "font-weight:bold;", "font-weight:bold;")}
      <div style="padding-left:10px; font-size:11px;">${qtyLine}</div>
      ${accompHtml(item.accompaniments)}
    </div>`;
    })
    .join("");
}

function customerBody(data: ReceiptData): string {
  return `
  ${blockCenter(`<span style="font-size:17px; font-weight:bold;">${data.restaurant.name}</span>`)}
  ${data.restaurant.address ? blockCenter(data.restaurant.address, "font-size:11px;") : ""}
  ${data.restaurant.phone ? blockCenter(data.restaurant.phone, "font-size:11px;") : ""}
  ${divider()}
  ${row("Order #", String(data.order.number), "font-weight:bold;", "font-weight:bold;")}
  ${row("Waiter", data.waiter.name)}
  ${row("Date", formatDate(data.order.createdAt))}
  ${row("Meal", data.order.mealType)}
  ${row("Payment", data.order.paymentMethod)}
  ${divider()}
  ${itemLinesHtml(data)}
  ${divider()}
  ${row("Items", money(data.totals.itemsPrice))}
  ${row("Shipping", money(data.totals.shippingPrice))}
  ${row("Tax", money(data.totals.taxPrice))}
  ${row("Total", money(data.totals.totalPrice), "font-weight:bold;", "font-weight:bold; font-size:15px;")}
  ${divider()}
  ${blockCenter("Thank You! Visit Again", "font-weight:bold; margin-top:4px;")}
  ${blockCenter(`<span style="letter-spacing:4px;">*${data.barcode}*</span>`, "margin-top:4px;")}`;
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
