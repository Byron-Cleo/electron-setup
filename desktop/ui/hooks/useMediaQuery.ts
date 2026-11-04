import { useEffect, useState } from "react"

/**
 * Tracks a CSS media query from JS. Needed where the layout has to be computed
 * in JavaScript (chunking cards into fixed-size rows) rather than left to CSS.
 * The query is matched against the same breakpoints Tailwind uses, so the JS
 * value and the CSS grid always agree.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [query])

  return matches
}

export default useMediaQuery
