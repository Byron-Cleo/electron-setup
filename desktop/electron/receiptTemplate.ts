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

const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
] as const;

function code128Svg(value: string): string {
  const start = 104;
  const data = [...value].map((c) => c.charCodeAt(0) - 32);
  const checksum = (start + data.reduce((sum, v, i) => sum + v * (i + 1), 0)) % 103;
  const symbols = [start, ...data, checksum, 106];

  let modules = "";
  let moduleCount = 0;
  for (const s of symbols) {
    const pattern = CODE128_PATTERNS[s] ?? "";
    modules += pattern;
    moduleCount += [...pattern].reduce((sum, d) => sum + Number(d), 0);
  }

  const moduleWidth = 2;
  const height = 44;
  const quiet = 6 * moduleWidth;
  const width = moduleCount * moduleWidth + quiet * 2;

  let rects = "";
  let x = quiet;
  let drawing = true;
  for (const ch of modules) {
    const w = Number(ch) * moduleWidth;
    if (drawing) rects += `<rect x="${x}" y="0" width="${w}" height="${height}" fill="#000"/>`;
    x += w;
    drawing = !drawing;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" shape-rendering="crispEdges" style="display:block; margin:0 auto;">${rects}</svg>`;
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
  ${data.restaurant.branch ? blockCenter(`Branch: ${data.restaurant.branch}`, "font-size:11px; font-weight:bold;") : ""}
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
  ${blockCenter(code128Svg(data.barcode), "margin-top:6px;")}
  ${blockCenter(data.barcode, "font-size:11px; letter-spacing:2px; margin-top:2px;")}
  ${divider()}
  ${data.restaurant.poweredBy ? blockCenter(data.restaurant.poweredBy, "font-size:11px; margin-top:4px;") : ""}
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
