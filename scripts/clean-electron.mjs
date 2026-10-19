#!/usr/bin/env node
// Wipes the compiled Electron output (dist-electron) before a build.
//
// Why this exists: `tsc -b` is incremental and skips sources whose emitted
// output is newer than the source file. scripts/build-network.mjs rewrites the
// already-compiled dist-electron/server-config.js to bake a network API base,
// which makes that output newer than server-config.ts — so a later plain
// `tsc -b` would silently reuse the stale network-baked file. Cleaning first
// forces every build to recompile from source.

import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const target = path.join(root, "dist-electron");

rmSync(target, { recursive: true, force: true });
console.log(`Cleaned ${target}`);
