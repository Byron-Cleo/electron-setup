/**
 * Shared customer-receipt construction for orders that already exist in the
 * database (cashier reprint). The waiter's placement flow builds its receipt
 * from the in-memory cart instead — see `WaiterMenu.tsx`.
 */

export const RESTAURANT_INFO: ReceiptData["restaurant"] = {
  name: "ERAEVA CATERING SERVICES",
  branch: "Airport",
  address: "P.O BOX 75531-00200",
  city: "Nairobi",
  phone: "0712345678",
  tel: "0701315250",
  poweredBy: "Apydy Technologies",
  services: "Hotel Systems, Supermarket Systems, Website Apps, Mobile Applications",
}

export interface ReceiptFromOrderOptions {
  /** Stamps the ticket with ** REPRINT COPY ** (never set for the waiter's original). */
  isReprint?: boolean
  /** Order number this one replaces, when it was issued against a voided order. */
  replacesOrderNumber?: number
}

/**
 * Maps a persisted `Order` (as returned by `GET /orders`) onto `ReceiptData`.
 * Line math mirrors the Cashier details dialog: the stored `item.price` is the
 * portion-resolved unit price, and charged starch/vegetable selections are
 * added on top per unit.
 */
export function receiptFromOrder(order: Order, opts: ReceiptFromOrderOptions = {}): ReceiptData {
  const items: ReceiptItem[] = order.OrderItem.map((item) => {
    const starch = item.Starch
    const vegetable = item.Vegetable
    const unitPrice = Number(item.price)
    const starchPrice = Number(starch?.price ?? 0)
    const vegetablePrice = Number(vegetable?.price ?? 0)
    const accompaniments: ReceiptAccompaniment[] = [
      ...(starch ? [{ name: starch.name, charged: starchPrice > 0, price: starchPrice }] : []),
      ...(vegetable ? [{ name: vegetable.name, charged: vegetablePrice > 0, price: vegetablePrice }] : []),
    ]
    return {
      name: item.name,
      accompaniments,
      qty: item.qty,
      unitPrice,
      lineTotal: (unitPrice + starchPrice + vegetablePrice) * item.qty,
    }
  })

  return {
    ticket: "customer",
    order: {
      id: order.id,
      number: order.orderNumber,
      mealType: order.mealType,
      createdAt: order.createdAt,
      paymentMethod: order.paymentMethod,
      ...(opts.replacesOrderNumber != null ? { replacesOrderNumber: opts.replacesOrderNumber } : {}),
    },
    restaurant: { ...RESTAURANT_INFO },
    waiter: { name: order.User?.name ?? "—" },
    items,
    totals: {
      itemsPrice: Number(order.itemsPrice),
      shippingPrice: Number(order.shippingPrice),
      taxPrice: Number(order.taxPrice),
      totalPrice: Number(order.totalPrice),
    },
    barcode: String(order.orderNumber),
    ...(opts.isReprint ? { isReprint: true } : {}),
  }
}
