#!/usr/bin/env node
// Builds an installable Electron app whose API calls go to a remote server
// instead of http://localhost:3001. Run it on the machine that will host the
// built app (e.g. a Windows terminal).
//
// Usage:
//   npm run build:win:network -- --server http://192.168.1.100:3001
//   npm run build:network -- --server http://192.168.1.100:3001 --platform mac
//   API_SERVER=http://192.168.1.100:3001 npm run build:win:network
//
// It bakes the server address into BOTH:
//   - the renderer (VITE_API_BASE / VITE_API_ORIGIN used by lib/api.ts, incl. image URLs)
//   - the Electron main process (DEFAULT_API_BASE fallback in server-config.ts,
//     used by IPC apiFetch and the Settings → Server Connection screen)
//
// A runtime override is still possible via the server-config.json file created
// from the Settings screen, or by setting the API_BASE env var when launching.
//
// Extra flags:
//   --out-dir <dir>          write the installer to <dir> instead of release/
//                            (e.g. release-tailscale/), so a second, separately
//                            distributed build does not overwrite the first one
//   --artifact-suffix <text> tag the installer filename, e.g. "tailscale" turns
//                            "...-0.0.3-win-x64.exe" into "...-0.0.3-tailscale-win-x64.exe"
//
// IMPORTANT: this script rebuilds dist-react/, which the backend serves at
// http://<host>:3001 for the browser view. After running it on the server, run
// `npm run build:web -- --server same-origin` to restore the served bundle.

import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, isAbsolute, normalize } from "node:path"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const isWindows = process.platform === "win32"

function argValue(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const platform = (argValue("--platform") || process.env.BUILD_PLATFORM || "win").toLowerCase()
const server = argValue("--server") || process.env.API_SERVER

if (!server) {
  console.error("Error: missing server URL.\n")
  console.error("Usage: npm run build:network -- --server http://<server-ip>:3001 [--platform win|mac|linux]")
  console.error("   or: npm run build:win:network -- --server http://<server-ip>:3001")
  console.error("   or: API_SERVER=http://<server-ip>:3001 npm run build:win:network")
  process.exit(1)
}

// Output directory override. Keeps a second, separately distributed build (e.g. a
// Tailscale-tailnet installer) in its own folder so it never overwrites the
// default release/ installer.
const outDir = argValue("--out-dir") || process.env.BUILD_OUT_DIR || "release"
const artifactSuffix = argValue("--artifact-suffix") || process.env.BUILD_ARTIFACT_SUFFIX || ""

function resolveOutDir() {
  if (isAbsolute(outDir)) {
    console.error(`Error: --out-dir must be a relative path inside the project (got "${outDir}").`)
    process.exit(1)
  }
  const normalized = normalize(outDir).replace(/[\\/]+$/, "")
  if (!normalized || normalized === "." || normalized.startsWith("..") || isAbsolute(normalized)) {
    console.error(`Error: --out-dir must stay inside the project directory (got "${outDir}").`)
    process.exit(1)
  }
  return normalized.split(/[\\/]+/).join("/")
}

const outputDir = resolveOutDir()

const origin = server.replace(/\/+$/, "").replace(/\/api$/, "")
const apiBase = `${origin}/api`

console.log(`Target platform : ${platform}`)
console.log(`API base        : ${apiBase}`)
console.log(`API origin      : ${origin}`)
console.log(`Output directory: ${outputDir}`)
if (artifactSuffix) console.log(`Artifact suffix : ${artifactSuffix}`)

const env = {
  ...process.env,
  VITE_API_BASE: apiBase,
  VITE_API_ORIGIN: origin,
}

function run(label, cmd, args) {
  console.log(`\n==> ${label}`)
  const res = spawnSync(cmd, args, { cwd: root, env, stdio: "inherit", shell: isWindows })
  if (res.error) {
    console.error(`Failed to start "${cmd}": ${res.error.message}`)
    process.exit(1)
  }
  if (res.status !== 0) process.exit(res.status ?? 1)
}

// 1. Build the React renderer. vite build transpiles with esbuild (no strict
//    type-check), so it works even while unrelated *.tsx type errors exist.
run("Building renderer (vite build)", "npx", ["vite", "build"])

// 2. Compile the Electron main process only, from a clean output so an older
//    run's network-baked server-config.js is never reused.
run("Cleaning Electron output", "node", ["scripts/clean-electron.mjs"])
run("Compiling Electron main process", "npm", ["run", "transpile:electron"])

// 3. Bake the network API base into the compiled Electron main process.
const serverConfigPath = join(root, "dist-electron", "server-config.js")
if (!existsSync(serverConfigPath)) {
  console.error(`Missing ${serverConfigPath} — the Electron build did not produce it.`)
  process.exit(1)
}
const fallback = "http://192.168.100.45:3001/api"
let code = readFileSync(serverConfigPath, "utf8")
if (!code.includes(fallback)) {
  console.error(`Could not find fallback API base (${fallback}) in ${serverConfigPath}.`)
  process.exit(1)
}
code = code.replaceAll(fallback, apiBase)
writeFileSync(serverConfigPath, code)
console.log(`Baked API base into ${serverConfigPath}: ${apiBase}`)

// 4. Package installers for the requested platform.
const platformFlag = { win: "--win", mac: "--mac", linux: "--linux" }[platform]
if (!platformFlag) {
  console.error(`Unknown platform: "${platform}" (use win, mac or linux).`)
  process.exit(1)
}

// electron-builder reads directories.output from electron-builder.json; the CLI
// override below is deep-merged over it, so buildResources / files / win.target
// are all preserved.
const builderArgs = ["electron-builder", platformFlag, "--config", "electron-builder.json"]
if (outputDir !== "release") {
  builderArgs.push(`--config.directories.output=${outputDir}`)
}

// Tag the installer filename so a separately distributed build is self-identifying,
// e.g. "Eraeva POS System-0.0.3-tailscale-win-x64.exe".
if (artifactSuffix) {
  const builderConfigPath = join(root, "electron-builder.json")
  const builderConfig = JSON.parse(readFileSync(builderConfigPath, "utf8"))
  const baseArtifactName = builderConfig[platform]?.artifactName
  if (!baseArtifactName) {
    console.error(`No artifactName template for platform "${platform}" in ${builderConfigPath}.`)
    process.exit(1)
  }
  const platformToken = `-${platform}-`
  if (!baseArtifactName.includes(platformToken)) {
    console.error(`Could not locate "${platformToken}" in artifactName "${baseArtifactName}".`)
    process.exit(1)
  }
  const taggedArtifactName = baseArtifactName.replace(platformToken, `-${artifactSuffix}${platformToken}`)
  builderArgs.push(`--config.${platform}.artifactName=${taggedArtifactName}`)
  console.log(`Artifact name    : ${taggedArtifactName}`)
}

run(`Packaging for ${platform}`, "npx", builderArgs)

console.log(`\nDone. Installers are in: ${join(root, outputDir)}`)

if (outputDir !== "release") {
  console.log(`\nThe LAN installer in ${join(root, "release")} was not touched.`)
}
console.log(
  `\nNOTE: this build rewrote dist-react/, which the backend serves at http://<host>:3001.\n` +
  `      Re-run "npm run build:web -- --server same-origin" to restore the browser view.`
)
