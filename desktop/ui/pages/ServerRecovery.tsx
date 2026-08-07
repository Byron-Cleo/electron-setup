import { useState } from "react"
import { Loader2, RefreshCw, ServerOff } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  apiBase: string
  onReconnect: (serverUrl: string) => Promise<void>
  onRetry: () => void
}

function normalizeServerUrl(value: string): string {
  let v = value.trim()
  if (!v) return ""
  if (!/^https?:\/\//i.test(v)) v = `http://${v}`
  return v.replace(/\/+$/, "")
}

function ServerRecovery({ apiBase, onReconnect, onRetry }: Props) {
  const [serverUrl, setServerUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function handleReconnect() {
    const normalized = normalizeServerUrl(serverUrl)
    if (!normalized) {
      setError("Enter the server IP or URL first (e.g. 192.168.1.50:3001)")
      return
    }
    setBusy(true)
    setError("")
    try {
      await onReconnect(normalized)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not reach the server. Check the IP and try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-dvh overflow-hidden bg-[#F5EDE0] text-brand-ebony flex flex-col items-center justify-center font-sans p-4 selection:bg-brand-gold/30">
      <div className="flex flex-col items-center mb-6">
        <img
          src="./images/logo/eraeva-logo.png"
          alt="Eraeva Logo"
          className="w-24 h-24 object-contain rounded-2xl drop-shadow-[0_4px_20px_rgba(181,103,37,0.3)] mb-4"
        />
        <p className="text-brand-maroon text-2xl font-bold tracking-wide uppercase leading-none">
          Eraeva POS System
        </p>
      </div>

      <Card className="w-full max-w-md bg-brand-tan border-brand-ebony/10 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-brand-red/10 text-brand-red">
            <ServerOff className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-brand-green leading-tight">Server Not Reachable</h1>
            <p className="text-sm text-brand-ebony/70">Can't reach the POS server. Enter the correct server IP below to reconnect.</p>
          </div>
        </div>

        <div className="rounded-xl bg-brand-ebony/5 border border-brand-ebony/10 px-3 py-2">
          <div className="text-xs text-brand-ebony/60">Current server</div>
          <div className="font-mono text-sm text-brand-ebony break-all">{apiBase || "not configured"}</div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-brand-ebony">Server IP / URL</Label>
          <Input
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="e.g. 192.168.1.50:3001"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) void handleReconnect()
            }}
            className="bg-background"
          />
          <p className="text-xs text-brand-ebony/60">
            You can enter just the IP (192.168.1.50), the IP with port (192.168.1.50:3001),
            or a full URL (http://192.168.1.50:3001).
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            onClick={() => void handleReconnect()}
            disabled={busy}
            className="flex-1 bg-brand-red text-white hover:bg-brand-red/85 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {busy ? "Reconnecting..." : "Reconnect"}
          </Button>
          <Button variant="outline" onClick={onRetry} disabled={busy} className="bg-background">
            Try Again
          </Button>
        </div>

        {error && <p className="text-sm text-brand-red text-center">{error}</p>}
      </Card>
    </div>
  )
}

export default ServerRecovery
