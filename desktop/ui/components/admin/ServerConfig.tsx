import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import BackButton from "@/components/shared/BackButton"
import { Heading } from "@/components/ui/heading"
import { Server } from "lucide-react"
import {
  getServerConfig,
  saveServerConfig,
  getServerApiBase,
  testServerConnection,
} from "@/lib/api"

interface Props {
  onBack: () => void
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong"
}

function normalizeServerUrl(value: string): string {
  let v = value.trim()
  if (!v) return ""
  if (!/^https?:\/\//i.test(v)) v = `http://${v}`
  return v.replace(/\/+$/, "")
}

function StatusBadge({ status, checking }: { status: ServerStatus | null; checking: boolean }) {
  if (checking) {
    return (
      <span className="inline-flex items-center gap-1.5 text-admin-header-text/60">
        <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400" />
        Testing...
      </span>
    )
  }
  if (!status || status.online === null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-admin-header-text/60">
        <span className="h-2 w-2 rounded-full bg-gray-400" />
        Not tested
      </span>
    )
  }
  if (status.online) {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-green-700" title={status.reason}>
        <span className="h-2 w-2 rounded-full bg-green-500" />
        Connected
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-red-600" title={status.reason}>
      <span className="h-2 w-2 rounded-full bg-red-500" />
      Unreachable
    </span>
  )
}

export default function ServerConfig({ onBack }: Props) {
  const [serverUrl, setServerUrl] = useState("")
  const [apiBase, setApiBase] = useState("")
  const [status, setStatus] = useState<ServerStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    Promise.all([getServerConfig(), getServerApiBase()])
      .then(([config, base]) => {
        if (cancelled) return
        setServerUrl(config.serverUrl ?? "")
        setApiBase(base)
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

  async function handleTest() {
    const normalized = normalizeServerUrl(serverUrl)
    if (!normalized) {
      setStatus({ online: false, reason: "Enter a server IP or URL first" })
      return
    }
    setTesting(true)
    setStatus(null)
    setError("")
    try {
      await saveServerConfig({ serverUrl: normalized })
      setStatus(await testServerConnection())
      setApiBase(await getServerApiBase())
    } catch (e: unknown) {
      setStatus({ online: false, reason: errMessage(e) })
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    const normalized = normalizeServerUrl(serverUrl)
    if (!normalized) {
      setError("Enter the server IP or URL (e.g. 192.168.1.50:3001)")
      return
    }
    setSaving(true)
    setError("")
    try {
      await saveServerConfig({ serverUrl: normalized })
      setApiBase(await getServerApiBase())
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
        <Button onClick={handleSave} disabled={saving} className="px-6 py-6">
          <Server className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Server"}
        </Button>
      </div>

      <Heading as="h2" className="mb-2 text-admin-header-text text-center">Server Connection</Heading>
      <p className="text-sm text-admin-muted mb-6 text-center">
        Enter the IP address of the computer running the Eraeva backend. All terminals will use this server.
      </p>

      {loading && <p className="text-center text-admin-muted">Loading...</p>}

      {!loading && (
        <Card className="p-6 max-w-xl mx-auto space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-admin-header-text">Server IP / URL</Label>
            <Input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="e.g. 192.168.1.50:3001"
            />
            <p className="text-xs text-admin-muted">
              You can enter just the IP (192.168.1.50), the IP with port (192.168.1.50:3001),
              or a full URL (http://192.168.1.50:3001).
            </p>
          </div>

          {apiBase && (
            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
              <div className="text-admin-header-text/50">API endpoint that will be used</div>
              <div className="font-mono text-admin-header-text break-all">{apiBase}</div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <StatusBadge status={status} checking={testing} />
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || !serverUrl.trim()}
            >
              {testing ? "Testing..." : "Test Connection"}
            </Button>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </Card>
      )}
    </div>
  )
}
