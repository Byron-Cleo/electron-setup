import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import BackButton from "@/components/shared/BackButton"
import { Heading } from "@/components/ui/heading"
import { Rocket } from "lucide-react"
import { getSystemSettings, updateSystemSettings } from "@/lib/api"

interface Props {
  onBack: () => void
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong"
}

function GoLiveModeSettings({ onBack }: Props) {
  const [showGoLiveInput, setShowGoLiveInput] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    getSystemSettings()
      .then((settings) => {
        if (!cancelled) setShowGoLiveInput(settings.showGoLiveInput)
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
      const settings = await updateSystemSettings({ showGoLiveInput })
      setShowGoLiveInput(settings.showGoLiveInput)
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
          <Rocket className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <Heading as="h2" className="mb-2 text-admin-header-text text-center">Go-Live Mode</Heading>
      <p className="text-sm text-admin-muted mb-6 text-center">
        Control the one-time catch-up input used on the day the system goes live, when food
        may already have been sold on paper before it was keyed in.
      </p>

      {loading && <p className="text-center text-admin-muted">Loading...</p>}

      {!loading && (
        <Card className="p-6 max-w-xl mx-auto space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={showGoLiveInput}
              onCheckedChange={(v) => {
                setShowGoLiveInput(v === true)
                setSaved(false)
              }}
              className="mt-0.5"
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium text-admin-header-text">
                Show "already sold before keying in" inputs on Kitchen screens
              </span>
              <span className="block text-xs text-admin-muted">
                Adds a red card to the cooking dialogs where staff can enter plates sold
                off-system (no order) so the POS shows the true remaining stock.
              </span>
            </span>
          </label>

          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
            Turn this OFF once the go-live catch-up is finished. Hiding the inputs removes
            the red cards everywhere, but any pre-system figures already entered stay in
            history and reports.
          </div>

          {saved && <p className="text-sm text-green-600">Saved.</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </Card>
      )}
    </div>
  )
}

export default GoLiveModeSettings
