"use client"

import { Calendar } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DatePickerProps {
  value?: Date | null
  onChange: (date: Date | null) => void
  placeholder?: string
  className?: string
}

export function DatePicker({ value, onChange, placeholder = "Select date", className }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(value ?? undefined)
  const [prevValue, setPrevValue] = useState<Date | null | undefined>(value)

  // Sync internal display when the controlled value is reset by the parent
  // (e.g. the "Last 7 days" button in Reports). Adjusts state during render —
  // the React-recommended alternative to syncing in an effect.
  if (value !== prevValue) {
    setPrevValue(value)
    setSelectedDate(value ?? undefined)
  }

  function handleSelect(date: Date) {
    setSelectedDate(date)
    onChange(date)
    setOpen(false)
  }

  function handleClear() {
    setSelectedDate(undefined)
    onChange(null)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-[180px] justify-between text-left font-normal", className)}
          size="sm"
        >
          {selectedDate ? (
            selectedDate.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <Calendar className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" sideOffset={5}>
        <div className="p-3">
          <CalendarComponent
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            initialFocus
            className="rounded-md border"
          />
          <div className="flex items-center justify-end gap-2 mt-3">
            <Button variant="ghost" size="sm" onClick={handleClear} disabled={!selectedDate}>
              Clear
            </Button>
            <Button size="sm" onClick={() => setOpen(false)}>Done</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}