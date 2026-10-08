import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Heading } from "@/components/ui/heading"
import BackButton from "@/components/shared/BackButton"
import { getCustomerById, type CustomerDetail, type LedgerOrder } from "@/lib/api"
import { formatPaymentMethod } from "@/lib/payment"

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getCustomerById(id).then((data) => {
      setCustomer(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  if (loading) return <p className="text-center py-8">Loading...</p>
  if (!customer) return <p className="text-center py-8 text-red-500">Customer not found</p>

  const openOrders = customer.orders || []
  const settledOrders = customer.settledOrders || []
  const cancelledOrders = customer.cancelledOrders || []

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <BackButton onClick={() => navigate("/admin/customers")} />
      </div>
      <Heading as="h2" className="text-admin-header-text text-center uppercase">{customer.name}</Heading>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        <div className="border rounded-lg p-4 bg-card">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Phone</p>
          <p className="text-lg font-medium text-admin-header-text">{customer.phone}</p>
        </div>
        <div className="border rounded-lg p-4 bg-card">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Notes</p>
          <p className="text-sm text-admin-header-text/80">{customer.notes || "—"}</p>
        </div>
        <div className="border rounded-lg p-4 bg-brand-green/10">
          <p className="text-xs text-brand-green uppercase font-semibold">Outstanding</p>
          <p className="text-xl font-bold text-brand-green">{Number(customer.outstandingTotal ?? 0).toFixed(0)} KSH</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-4">
        <section className="border rounded-lg overflow-hidden">
          <div className="bg-brand-green/10 px-4 py-2">
            <h3 className="font-semibold text-brand-green">Open (Unpaid) — {openOrders.length}</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2">Order #</th>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Shift</th>
                <th className="text-left px-4 py-2">Period</th>
                <th className="text-right px-4 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {openOrders.map((o: LedgerOrder) => (
                <tr key={o.id} className="border-t hover:bg-muted/10">
                  <td className="px-4 py-2">#{o.orderNumber ?? o.id.slice(0, 6)}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{new Date(o.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-xs">{o.shift?.type || "—"}</td>
                  <td className="px-4 py-2 text-xs">{o.mealType || "—"}</td>
                  <td className="px-4 py-2 text-right font-medium">{Number(o.totalPrice ?? 0).toFixed(0)} KSH</td>
                </tr>
              ))}
              {openOrders.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">No open orders</td></tr>}
            </tbody>
          </table>
        </section>

        <section className="border rounded-lg overflow-hidden">
          <div className="bg-blue-500/10 px-4 py-2">
            <h3 className="font-semibold text-blue-600">Settled (Paid) — {settledOrders.length}</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2">Order #</th>
                <th className="text-left px-4 py-2">Date Paid</th>
                <th className="text-left px-4 py-2">Method</th>
              </tr>
            </thead>
            <tbody>
              {settledOrders.map((o: LedgerOrder) => (
                <tr key={o.id} className="border-t hover:bg-muted/10">
                  <td className="px-4 py-2">#{o.orderNumber ?? o.id.slice(0, 6)}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{o.paidAt ? new Date(o.paidAt).toLocaleString() : "—"}</td>
                  <td className="px-4 py-2 text-xs">{formatPaymentMethod(o.paymentMethod) || "—"}</td>
                </tr>
              ))}
              {settledOrders.length === 0 && <tr><td colSpan={3} className="text-center py-4 text-muted-foreground">No settled orders</td></tr>}
            </tbody>
          </table>
        </section>

        <section className="border rounded-lg overflow-hidden bg-muted/20">
          <div className="bg-muted px-4 py-2">
            <h3 className="font-semibold text-muted-foreground">Cancelled (Void) — {cancelledOrders.length}</h3>
          </div>
          <table className="w-full text-sm text-muted-foreground">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2">Order #</th>
                <th className="text-left px-4 py-2">Replaced By</th>
              </tr>
            </thead>
            <tbody>
              {cancelledOrders.map((o: LedgerOrder) => (
                <tr key={o.id} className="border-t hover:bg-muted/10 line-through">
                  <td className="px-4 py-2">#{o.orderNumber ?? o.id.slice(0, 6)}</td>
                  <td className="px-4 py-2 text-xs">
                    {o.replacedByOrderNumber != null ? `Replaced by #${o.replacedByOrderNumber}` : "—"}
                  </td>
                </tr>
              ))}
              {cancelledOrders.length === 0 && <tr><td colSpan={2} className="text-center py-4">No cancelled orders</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}
