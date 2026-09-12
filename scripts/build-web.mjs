#!/usr/bin/env node
// Builds ONLY the renderer web bundle (dist-react) pointed at a remote server,
// so the backend can serve the web interface over WiFi at http://<server-ip>:3001.
// Unlike build-network.mjs, this skips electron-builder — it's for refreshing
// the browser-accessible app without producing a new desktop installer.
//
// Usage:
//   npm run build:web -- --server http://192.168.1.100:3001
//   API_SERVER=http://192.168.1.100:3001 npm run build:web
//   npm run build:web -- --server same-origin   # API follows the host the UI is opened on
//
// After this, start the backend (`npm run dev:backend`) and any device on the
// network can open http://<server-ip>:3001.

import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const isWindows = process.platform === "win32"

function argValue(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const server = argValue("--server") || process.env.API_SERVER

if (!server) {
  console.error("Error: missing server URL.\n")
  console.error("Usage: npm run build:web -- --server http://<server-ip>:3001")
  console.error("   or: npm run build:web -- --server same-origin")
  console.error("   or: API_SERVER=http://<server-ip>:3001 npm run build:web")
  process.exit(1)
}

const env = { ...process.env }

let displayOrigin
if (server === "same-origin") {
  // Bake no origin: lib/api.ts resolves the API to whatever host the UI is
  // opened on, so it works over the SSH tunnel (localhost), LAN, or Tailscale.
  displayOrigin = "<same-origin>"
  delete env.VITE_API_BASE
  delete env.VITE_API_ORIGIN
} else {
  const origin = server.replace(/\/+$/, "").replace(/\/api$/, "")
  const apiBase = `${origin}/api`
  displayOrigin = origin
  env.VITE_API_BASE = apiBase
  env.VITE_API_ORIGIN = origin
}

console.log(`API base   : ${displayOrigin}/api`)
console.log(`API origin : ${displayOrigin}`)

// Note: --base=/ overrides vite.config.ts's "./" (relative base used for the
// Electron file:// build). Absolute paths are required so deep links like
// /admin/menu resolve /assets/* from the server root instead of /admin/assets/*.
const res = spawnSync("npx", ["vite", "build", "--base=/"], { cwd: root, env, stdio: "inherit", shell: isWindows })
if (res.error) {
  console.error(`Failed to start vite: ${res.error.message}`)
  process.exit(1)
}
if (res.status !== 0) process.exit(res.status ?? 1)

console.log(`\nDone. Start the backend (npm run dev:backend), then open the served UI from any device on the network.`)
