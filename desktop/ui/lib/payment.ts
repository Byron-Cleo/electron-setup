/**
 * Shared helpers for the M-Pesa + Cash partial payment method.
 *
 * A partial payment (`paymentMethod = "mpesa-cash-partial"`) is one order
 * settled with two keyed portions: an M-Pesa amount and a cash amount. The
 * portions are persisted on the order (`mpesaAmount` / `cashAmount`) and must
 * reconcile exactly with the order total (or, in batch mode, with the batch
 * total, which is then allocated across orders).
 */

export const PARTIAL_METHOD = "mpesa-cash-partial"

export type PaymentMethodValue = "cash" | "mpesa" | "mpesa-cash-partial"

export function isPartialMethod(method: string | null | undefined): boolean {
  return method === PARTIAL_METHOD
}

/** Human-readable label for a stored payment method value. */
export function formatPaymentMethod(method: string | null | undefined): string {
  if (method === "mpesa") return "M-Pesa"
  if (method === PARTIAL_METHOD) return "M-Pesa + Cash"
  if (method === "cash") return "Cash"
  if (method === "unpaid" || !method) return "Unpaid"
  return method
}

export interface SplitValidation {
  ok: boolean
  /** total - (mpesa + cash) in shillings: > 0 short, < 0 over, ~0 balanced. */
  difference: number
}

/** Do the keyed portions reconcile with the total? Compared in cents. */
export function validateSplit(mpesa: number, cash: number, total: number): SplitValidation {
  const difference = Math.round((total - (mpesa + cash)) * 100) / 100
  return { ok: Math.abs(difference) < 0.005, difference }
}

export interface BatchSplitAllocation {
  id: string
  mpesaAmount: number
  cashAmount: number
}

/**
 * Sequential fill: pour the keyed M-Pesa total across the orders one by one
 * (each order takes as much M-Pesa as fits, its remainder is cash). The
 * per-order portions always sum exactly to the keyed totals — no rounding
 * drift — and each order's own portions sum to its own total.
 *
 * Callers must have validated mpesaTotal + cashTotal === batch total first;
 * the cash portions are derived as each order's remainder, so the cash total
 * is consumed exactly by construction.
 */
export function allocateBatchSplit(
  orders: Array<{ id: string; total: number }>,
  mpesaTotal: number,
): BatchSplitAllocation[] {
  let mpesaLeft = Math.round(mpesaTotal * 100) / 100
  return orders.map((order) => {
    const total = Math.round(order.total * 100) / 100
    const mpesaAmount = Math.round(Math.min(mpesaLeft, total) * 100) / 100
    mpesaLeft = Math.round((mpesaLeft - mpesaAmount) * 100) / 100
    return {
      id: order.id,
      mpesaAmount,
      cashAmount: Math.round((total - mpesaAmount) * 100) / 100,
    }
  })
}
