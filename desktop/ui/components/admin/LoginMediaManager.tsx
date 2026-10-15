import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Heading } from "@/components/ui/heading"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import BackButton from "@/components/shared/BackButton"
import {
  getLoginMediaLibrary,
  saveLoginMediaConfig,
  saveLoginMediaSelection,
  uploadLoginMediaVideo,
  orderLoginMediaVideos,
  toggleLoginMediaVideo,
  deleteLoginMediaVideo,
  menuImageUrl,
} from "@/lib/api"
import {
  ArrowDown,
  ArrowUp,
  Check,
  Image as ImageIcon,
  Loader2,
  MonitorPlay,
  Trash2,
  Upload,
  Video,
} from "lucide-react"

interface Props {
  onBack: () => void
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong"
}

export default function LoginMediaManager({ onBack }: Props) {
  const [library, setLibrary] = useState<LoginMediaLibrary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [savingConfig, setSavingConfig] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)

  const [mode, setMode] = useState<LoginMediaMode>("IMAGES")
  const [playback, setPlayback] = useState<LoginVideoPlayback>("SINGLE_LOOP")
  const [singleVideoId, setSingleVideoId] = useState<string | null>(null)
  const [intervalSec, setIntervalSec] = useState(2)
  const [activePaths, setActivePaths] = useState<string[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  function apply(data: LoginMediaLibrary) {
    setLibrary(data)
    setMode(data.config.mode)
    setPlayback(data.config.videoPlayback)
    setSingleVideoId(data.config.singleVideoId)
    setIntervalSec(data.config.slideIntervalSec)
    setActivePaths(data.images.filter((i) => i.isActive).map((i) => i.filePath))
  }

  useEffect(() => {
    let cancelled = false
    getLoginMediaLibrary()
      .then((data) => {
        if (!cancelled) apply(data)
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

  async function reload() {
    try {
      apply(await getLoginMediaLibrary())
    } catch (e) {
      setError(errMessage(e))
    }
  }

  const videos = library?.videos ?? []
  const activeVideos = videos.filter((v) => v.isActive)
  const videoModeBlocked = activeVideos.length === 0

  const configDirty =
    !!library &&
    (mode !== library.config.mode ||
      playback !== library.config.videoPlayback ||
      singleVideoId !== library.config.singleVideoId ||
      intervalSec !== library.config.slideIntervalSec)

  const singleMissing = mode === "VIDEO" && playback === "SINGLE_LOOP" && !singleVideoId

  async function handleSaveConfig() {
    setSavingConfig(true)
    setError("")
    try {
      const saved = await saveLoginMediaConfig({
        mode,
        videoPlayback: playback,
        singleVideoId,
        slideIntervalSec: intervalSec,
      })
      setLibrary((prev) => (prev ? { ...prev, config: saved } : prev))
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setSavingConfig(false)
    }
  }

  async function toggleImage(path: string, checked: boolean) {
    const previous = activePaths
    const next = checked ? [...activePaths, path] : activePaths.filter((p) => p !== path)
    setActivePaths(next)
    setError("")
    try {
      await saveLoginMediaSelection(next)
    } catch (e) {
      setActivePaths(previous)
      setError(errMessage(e))
    }
  }

  async function handleUpload(file: File) {
    setUploading(true)
    setError("")
    try {
      await uploadLoginMediaVideo(file)
      await reload()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true)
    setError("")
    try {
      await fn()
      await reload()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function moveVideo(index: number, dir: -1 | 1) {
    const ids = videos.map((v) => v.id)
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[index], ids[j]] = [ids[j], ids[index]]
    await withBusy(() => orderLoginMediaVideos(ids).then(() => undefined))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <BackButton onClick={onBack} />
        <Button
          onClick={handleSaveConfig}
          disabled={savingConfig || !configDirty || (mode === "VIDEO" && videoModeBlocked) || singleMissing}
          className="px-6 py-6 bg-brand-green hover:bg-brand-green/90"
        >
          {savingConfig ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          {savingConfig ? "Saving..." : "Save Display Mode"}
        </Button>
      </div>

      <Heading as="h2" className="mb-2 text-admin-header-text text-center">Login Screen Display</Heading>
      <p className="text-sm text-admin-muted mb-6 text-center">
        Choose what the login screen shows on the left: a slideshow of images, or a video.
        Images are shown by default; video only plays once you switch to it.
      </p>

      {loading && <p className="text-center text-admin-muted">Loading...</p>}

      {!loading && error && (
        <p className="mb-4 rounded-md bg-red-500/10 px-4 py-2 text-sm text-red-500">{error}</p>
      )}

      {!loading && library && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6 space-y-5">
            <div className="flex items-center gap-2">
              <MonitorPlay className="h-5 w-5 text-green-600" />
              <Heading as="h3" className="text-lg text-admin-header-text">Display Mode</Heading>
            </div>

            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as LoginMediaMode)}
              className="gap-2"
            >
              <label className="flex items-center gap-3 rounded-md border border-admin-border/60 p-3 cursor-pointer hover:border-admin-accent transition-colors">
                <RadioGroupItem value="IMAGES" />
                <ImageIcon className="h-4 w-4 text-admin-muted" />
                <div>
                  <div className="text-sm font-medium text-admin-header-text">Image slideshow</div>
                  <div className="text-xs text-admin-muted">Rotate through the selected images</div>
                </div>
              </label>
              <label
                className={`flex items-center gap-3 rounded-md border border-admin-border/60 p-3 transition-colors ${
                  videoModeBlocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-admin-accent"
                }`}
              >
                <RadioGroupItem value="VIDEO" disabled={videoModeBlocked} />
                <Video className="h-4 w-4 text-admin-muted" />
                <div>
                  <div className="text-sm font-medium text-admin-header-text">Video</div>
                  <div className="text-xs text-admin-muted">
                    {videoModeBlocked
                      ? "Upload and enable a video below to unlock"
                      : "Play a muted video instead of images"}
                  </div>
                </div>
              </label>
            </RadioGroup>

            {mode === "IMAGES" && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-admin-header-text">Seconds per image</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={intervalSec}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10)
                    setIntervalSec(Number.isNaN(n) ? 1 : Math.min(30, Math.max(1, n)))
                  }}
                  className="max-w-32"
                />
                <p className="text-xs text-admin-muted">Between 1 and 30 seconds.</p>
              </div>
            )}

            {mode === "VIDEO" && (
              <div className="space-y-4 border-t border-admin-border/60 pt-4">
                <RadioGroup
                  value={playback}
                  onValueChange={(v) => setPlayback(v as LoginVideoPlayback)}
                  className="gap-2"
                >
                  <label className="flex items-center gap-3 cursor-pointer">
                    <RadioGroupItem value="SINGLE_LOOP" />
                    <div>
                      <div className="text-sm font-medium text-admin-header-text">Loop one video</div>
                      <div className="text-xs text-admin-muted">Play a single clip over and over</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <RadioGroupItem value="PLAYLIST" />
                    <div>
                      <div className="text-sm font-medium text-admin-header-text">Playlist</div>
                      <div className="text-xs text-admin-muted">Play each enabled video in order, then repeat</div>
                    </div>
                  </label>
                </RadioGroup>

                {playback === "SINGLE_LOOP" && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-admin-header-text">Video to loop</Label>
                    <RadioGroup
                      value={singleVideoId ?? ""}
                      onValueChange={(v) => setSingleVideoId(v)}
                      className="gap-2"
                    >
                      {activeVideos.map((v, i) => (
                        <label key={v.id} className="flex items-center gap-3 cursor-pointer">
                          <RadioGroupItem value={v.id} />
                          <span className="text-sm text-admin-header-text">Video {i + 1}</span>
                        </label>
                      ))}
                    </RadioGroup>
                    {singleMissing && (
                      <p className="text-xs text-amber-600">Choose which video to loop.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {mode === "VIDEO" && videoModeBlocked && (
              <p className="text-xs text-amber-600">
                No enabled video — the login screen will keep showing images until one is added.
              </p>
            )}
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-green-600" />
              <Heading as="h3" className="text-lg text-admin-header-text">Images</Heading>
            </div>
            <p className="text-xs text-admin-muted">
              Tick the images to show in the slideshow. Changes apply immediately.
            </p>

            {library.images.length === 0 ? (
              <p className="text-sm text-admin-muted">
                No images found. Upload images under Menu or Accompaniments first.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                {library.images.map((img) => {
                  const url = menuImageUrl(img.filePath) ?? ""
                  const checked = activePaths.includes(img.filePath)
                  return (
                    <label
                      key={img.filePath}
                      className={`group relative aspect-square overflow-hidden rounded-md border cursor-pointer transition-colors ${
                        checked ? "border-green-600 ring-1 ring-green-600" : "border-admin-border/60"
                      }`}
                    >
                      <img
                        src={url}
                        alt={img.filePath}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-0.5 text-[9px] text-white">
                        {img.filePath.split("/").pop()}
                      </span>
                      <span className="absolute left-1.5 top-1.5 rounded bg-white/90 p-0.5">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleImage(img.filePath, v === true)}
                        />
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </Card>

          <Card className="p-6 space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="h-5 w-5 text-green-600" />
                <Heading as="h3" className="text-lg text-admin-header-text">Videos</Heading>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleUpload(f)
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {uploading ? "Uploading..." : "Upload Video"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-admin-muted">MP4 or WebM, up to 500 MB. Muted autoplay, looped.</p>

            {videos.length === 0 ? (
              <p className="text-sm text-admin-muted">No videos uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {videos.map((v, i) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 rounded-md border border-admin-border/60 p-2"
                  >
                    <video
                      src={menuImageUrl(v.url) ?? ""}
                      muted
                      preload="metadata"
                      className="h-14 w-24 shrink-0 rounded bg-black object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-admin-header-text">Video {i + 1}</div>
                      <div className="truncate text-xs text-admin-muted">{v.url.split("/").pop()}</div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-admin-header-text">
                      <Checkbox
                        checked={v.isActive}
                        onCheckedChange={(checked) =>
                          withBusy(() =>
                            toggleLoginMediaVideo(v.id, checked === true).then(() => undefined),
                          )
                        }
                      />
                      Enabled
                    </label>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy || i === 0}
                        onClick={() => moveVideo(i, -1)}
                        aria-label="Move up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy || i === videos.length - 1}
                        onClick={() => moveVideo(i, 1)}
                        aria-label="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          withBusy(() => deleteLoginMediaVideo(v.id).then(() => undefined))
                        }
                        aria-label="Delete video"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
