-- Mpesa-Cash Partial payments: per-order keyed portions of a split payment.
-- Only set when paymentMethod = 'mpesa-cash-partial'; pure cash/mpesa
-- payments leave them NULL.
ALTER TABLE "Order" ADD COLUMN "mpesaAmount" DECIMAL(12,2);
ALTER TABLE "Order" ADD COLUMN "cashAmount" DECIMAL(12,2);
