import { useEffect, useRef } from "react"
import { subscribeLive, type LiveEvent } from "@/lib/api"

// Real-time data refresh: subscribes to the backend live-event stream and calls
// `refetch(event)` whenever an event of one of `types` arrives. `refetch` is
// always the latest callback captured via a ref (updated in an effect), so
// consumers can pass an inline function that changes every render without
// re-subscribing.
export function useLiveRefresh(types: string[], refetch: (event: LiveEvent) => void) {
  const typesKey = types.join(",")
  const refetchRef = useRef(refetch)

  useEffect(() => {
    refetchRef.current = refetch
  })

  useEffect(() => {
    const eventTypes = new Set(typesKey ? typesKey.split(",") : [])
    const matches = (type: string) => eventTypes.has(type)

    return subscribeLive((event) => {
      if (matches(event.type)) {
        refetchRef.current(event)
      }
    })
  }, [typesKey])
}