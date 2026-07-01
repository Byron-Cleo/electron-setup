import { useState, useEffect } from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })
}

function formatLoginTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export function WaiterDateTime() {
  const [now, setNow] = useState(new Date())
  const [loginTime] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const currentDayIndex = now.getDay()

  return (
    <div className="flex items-center justify-center gap-6">
      <div className="flex items-center gap-1.5 shrink-0">
        {days.map((day, i) => (
          <span
            key={day}
            className={cn(
              "text-xs font-semibold px-2 py-0.5 rounded-full transition-colors",
              i === currentDayIndex
                ? "bg-brand-green text-white"
                : "text-gray-400",
            )}
          >
            {day}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-3 text-sm">
        <span className="text-brand-ebony font-medium">{formatDate(now)}</span>
        <span className="text-brand-ebony/40">|</span>
        <span className="flex items-center gap-1 text-brand-ebony/60">
          <Clock size={14} />
          {formatTime(now)}
        </span>
        <span className="text-brand-ebony/40">|</span>
        <span className="text-brand-ebony/40 text-xs">
          Logged in at {formatLoginTime(loginTime)}
        </span>
      </div>
    </div>
  )
}

export default WaiterDateTime
