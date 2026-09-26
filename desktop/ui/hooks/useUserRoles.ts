import { useEffect, useState } from "react"
import { getUsers } from "@/lib/api"

/**
 * User id -> role, for labelling who acknowledged an order as unpaid.
 *
 * `Order.unpaidAcknowledgedById` is a bare uuid with no relation to User,
 * so the role has to be resolved separately. Fetched once on mount rather
 * than alongside the orders, because roles change far less often than
 * orders do and this keeps the order refresh paths untouched.
 *
 * A failed lookup resolves to an empty map, which makes every marked order
 * fall back to "Manager Marked" rather than rendering blank.
 */
export function useUserRoles(): Map<string, string> {
  const [roles, setRoles] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    let cancelled = false
    getUsers()
      .then((users) => {
        if (cancelled) return
        setRoles(new Map(users.map((u) => [u.id, u.role])))
      })
      .catch(() => {
        /* keep the empty map; labels fall back rather than disappearing */
      })
    return () => {
      cancelled = true
    }
  }, [])

  return roles
}
