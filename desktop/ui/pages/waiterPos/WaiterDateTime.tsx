import { useState } from "react"

function formatLoginTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export function WaiterDateTime() {
  const [loginTime] = useState(new Date())

  return (
    <div className="flex items-center justify-center gap-6 text-sm">
      <span className="text-brand-ebony/40 text-xs">
        Logged in at {formatLoginTime(loginTime)}
      </span>
    </div>
  )
}

export default WaiterDateTime
