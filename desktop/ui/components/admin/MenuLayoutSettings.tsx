import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import BackButton from "@/components/shared/BackButton"
import { Heading } from "@/components/ui/heading"
import { LayoutGrid } from "lucide-react"
import { getSystemSettings, updateSystemSettings } from "@/lib/api"

interface Props {
  onBack: () => void
}

const OPTIONS: { value: MenuLayout | null; label: string; description: string }[] = [
  {
    value: "LIST",
    label: "List View",
    description:
      "Today's layout: every category is a section stacked down the page. Unchanged behaviour — use this if the waiters know the menu by heart.",
  },
  {
    value: "GRID",
    label: "Card Grid",
    description:
      "One card per category, all visible at once. Tap a card to open its dishes in a drawer below it. Faster to scan during a busy service.",
  },
  {
    value: null,
    label: "Not set",
    description:
      "No system override — each waiter uses their own localStorage preference. Defaults to List view if no preference saved.",
  },
]

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong"
}

function MenuLayoutSettings({ onBack }: Props) {
  const [layout, setLayout] = useState<MenuLayout | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    getSystemSettings()
      .then((settings) => {
        if (cancelled) return
        setLayout(settings.waiterMenuLayout)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errMessage(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError("")
    try {
      const settings = await updateSystemSettings({ waiterMenuLayout: layout })
      setLayout(settings.waiterMenuLayout)
      setSaved(true)
    } catch (e: unknown) {
      setError(errMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <BackButton onClick={onBack} />
        <Button onClick={handleSave} disabled={saving || loading} className="px-6 py-6">
          <LayoutGrid className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <Heading as="h2" className="mb-2 text-admin-header-text text-center">
        Waiter Menu Layout
      </Heading>
      <p className="text-sm text-admin-muted mb-6 text-center">
        Choose how the waiter POS lists dishes. Waiter terminals pick up a change within
        about a minute — no restart needed.
      </p>

      {loading && <p className="text-center text-admin-muted">Loading...</p>}

      {!loading && (
        <Card className="p-6 max-w-xl mx-auto space-y-4">
          <RadioGroup
            value={layout ?? "unset"}
            onValueChange={(value) => {
              setLayout(value === "unset" ? null : (value as MenuLayout))
              setSaved(false)
            }}
          >
            {OPTIONS.map((option) => (
              <div key={option.value ?? "unset"} className="flex items-start gap-3">
                <RadioGroupItem
                  value={option.value ?? "unset"}
                  id={`menu-layout-${option.value ?? "unset"}`}
                  className="mt-1"
                />
                <Label
                  htmlFor={`menu-layout-${option.value ?? "unset"}`}
                  className="flex-1 cursor-pointer space-y-1"
                >
                  <span className="block text-sm font-medium text-admin-header-text">
                    {option.label}
                  </span>
                  <span className="block text-xs text-admin-muted">{option.description}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
            No system override — each waiter uses their own localStorage preference. Defaults to List view if no preference saved. Switching to the card grid changes only how dishes are listed — prices, stock counts and the order itself are unaffected.
          </div>

          {saved && <p className="text-sm text-green-600">Saved.</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </Card>
      )}
    </div>
  )
}

export default MenuLayoutSettings
