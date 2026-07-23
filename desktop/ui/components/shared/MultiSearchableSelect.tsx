import { useState, useMemo, useRef, useEffect } from "react"
import { Search, X, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface MultiSearchableSelectOption {
  value: string
  label: string
}

interface Props {
  options: MultiSearchableSelectOption[]
  value: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  className?: string
  maxVisibleTags?: number
}

export default function MultiSearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select options...",
  searchPlaceholder = "Search...",
  disabled = false,
  className,
  maxVisibleTags = 3,
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedLabels = useMemo(() => {
    return value.map((v) => options.find((opt) => opt.value === v)?.label ?? v)
  }, [options, value])

  const filteredOptions = useMemo(() => {
    if (!search) return options
    const q = search.toLowerCase()
    return options.filter((opt) => opt.label.toLowerCase().includes(q))
  }, [options, search])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleToggle() {
    if (disabled) return
    setOpen((prev) => !prev)
    if (!open) {
      setSearch("")
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  function handleToggleOption(option: MultiSearchableSelectOption) {
    if (value.includes(option.value)) {
      onChange(value.filter((v) => v !== option.value))
    } else {
      onChange([...value, option.value])
    }
  }

  function handleRemoveTag(e: React.MouseEvent, val: string) {
    e.stopPropagation()
    onChange(value.filter((v) => v !== val))
  }

  function handleClearAll(e: React.MouseEvent) {
    e.stopPropagation()
    onChange([])
    setSearch("")
  }

  const visibleTags = selectedLabels.slice(0, maxVisibleTags)
  const remainingCount = selectedLabels.length - maxVisibleTags

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          "flex min-h-8 w-full items-center justify-between gap-1 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none md:text-sm",
          "hover:bg-admin-content/50",
          disabled && "cursor-not-allowed opacity-50",
          open && "border-ring ring-3 ring-ring/50"
        )}
      >
        <div className="flex flex-1 flex-wrap items-center gap-1 truncate">
          {value.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            <>
              {visibleTags.map((label) => (
                <span
                  key={label}
                  className="flex items-center gap-1 rounded-md bg-admin-accent/10 px-1.5 py-0.5 text-xs font-medium text-admin-accent"
                >
                  <span className="truncate max-w-[100px]">{label}</span>
                  {!disabled && (
                    <span
                      onClick={(e) => {
                        const opt = options.find((o) => o.label === label)
                        if (opt) handleRemoveTag(e, opt.value)
                      }}
                      className="rounded-sm p-0.5 hover:bg-admin-accent/20 cursor-pointer"
                    >
                      <X size={10} />
                    </span>
                  )}
                </span>
              ))}
              {remainingCount > 0 && (
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  +{remainingCount} more
                </span>
              )}
            </>
          )}
        </div>
        <span className="flex items-center gap-1 shrink-0 ml-1">
          {value.length > 0 && !disabled && (
            <span
              onClick={handleClearAll}
              className="rounded-sm p-0.5 hover:bg-admin-content/50 cursor-pointer"
            >
              <X size={14} className="text-admin-muted" />
            </span>
          )}
          <ChevronDown size={14} className={cn("text-admin-muted transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-input bg-popover shadow-md">
          <div className="flex items-center gap-2 border-b border-input px-2.5 py-1.5">
            <Search size={14} className="shrink-0 text-admin-muted" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {options.length === 0 ? (
              <p className="px-2.5 py-2 text-sm text-admin-muted">No options available</p>
            ) : filteredOptions.length === 0 ? (
              <p className="px-2.5 py-2 text-sm text-admin-muted">No results found</p>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = value.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleToggleOption(opt)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-base transition-colors md:text-sm",
                      "hover:bg-admin-content/50",
                      isSelected && "bg-admin-accent/10 text-admin-accent font-medium"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        isSelected
                          ? "border-admin-accent bg-admin-accent text-white"
                          : "border-muted-foreground/50"
                      )}
                    >
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M8.5 2.5L3.5 7.5L1.5 5.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
