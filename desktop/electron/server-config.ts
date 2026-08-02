import { app, ipcMain } from "electron";
import fs from "fs";
import path from "path";

export interface ServerConfig {
  serverUrl?: string;
}

export interface ServerStatus {
  online: boolean | null;
  reason: string;
}

const CONFIG_FILENAME = "server-config.json";

// Baked-in default. The build-network script rewrites this literal to the
// network server address so the packaged app works without a config file.
const DEFAULT_API_BASE = "http://localhost:3001/api";

function toApiBase(value: string): string {
  const v = value.trim().replace(/\/+$/, "");
  return v.endsWith("/api") ? v : `${v}/api`;
}

export function getServerConfigPath(): string {
  return path.join(app.getPath("userData"), CONFIG_FILENAME);
}

export function readServerConfig(): ServerConfig {
  try {
    const raw = fs.readFileSync(getServerConfigPath(), "utf-8");
    const parsed = JSON.parse(raw) as Partial<ServerConfig>;
    if (typeof parsed.serverUrl === "string") {
      const url = parsed.serverUrl.trim().replace(/\/+$/, "");
      if (url) return { serverUrl: url };
    }
    return {};
  } catch {
    return {};
  }
}

export function writeServerConfig(config: ServerConfig): ServerConfig {
  fs.writeFileSync(getServerConfigPath(), JSON.stringify(config, null, 2), "utf-8");
  return config;
}

// Precedence: 1) server-config.json (user-editable)  2) API_BASE env var
//             3) baked-in default (localhost in dev, network server in builds)
export function getApiBase(): string {
  const fromConfig = readServerConfig().serverUrl;
  if (fromConfig) return toApiBase(fromConfig);
  if (process.env.API_BASE) return toApiBase(process.env.API_BASE);
  return DEFAULT_API_BASE;
}

export function getApiOrigin(): string {
  return getApiBase().replace(/\/api$/, "");
}

export async function testServerConnection(): Promise<ServerStatus> {
  const origin = getApiOrigin();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${origin}/health`, { signal: controller.signal });
    return { online: res.ok, reason: res.ok ? "Server reachable" : `HTTP ${res.status}` };
  } catch (err) {
    return { online: false, reason: err instanceof Error ? err.message : "Unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

export function registerServerConfigHandlers(): void {
  ipcMain.handle("server-config:get", async () => readServerConfig());
  ipcMain.handle("server-config:save", async (_event, config: ServerConfig) =>
    writeServerConfig(config)
  );
  ipcMain.handle("server-config:test", async () => testServerConnection());
  ipcMain.handle("server-config:get-api-base", async () => getApiBase());
}
