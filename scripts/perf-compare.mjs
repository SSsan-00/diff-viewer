#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { unlink, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const DEFAULT_APP_PORT = 4173;
const DEFAULT_LINES = 6500;
const DEFAULT_RUNS = 3;
const DEFAULT_SETTLE_MS = 2200;
const DEFAULT_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PERF_OUT_DIR = "perf-results";

function usage() {
  console.log(`Usage:
  node scripts/perf-compare.mjs capture [--label LABEL] [--out FILE] [--runs N] [--lines N] [--port N] [--settle-ms N] [--auto-dev]
  node scripts/perf-compare.mjs compare <before.json> <after.json>
`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  const positional = [];
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === "--") {
      continue;
    }
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    i += 1;
  }
  return { command, options, positional };
}

function toNumber(value, fallback) {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

function median(values) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function mean(values) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

function summary(values) {
  return {
    min: round(Math.min(...values)),
    max: round(Math.max(...values)),
    mean: round(mean(values)),
    median: round(median(values)),
  };
}

function sleep(ms) {
  return delay(ms);
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`${url}: ${res.status}`);
  }
  return res.json();
}

async function waitForHttp(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return;
      }
    } catch {
      // Retry until timeout.
    }
    await sleep(250);
  }
  throw new Error(`HTTP not ready: ${url}`);
}

async function waitForDevTools(port, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      return await fetchJson(`http://127.0.0.1:${port}/json/version`);
    } catch {
      // Retry until timeout.
    }
    await sleep(200);
  }
  throw new Error(`DevTools not ready on port ${port}`);
}

function createCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const events = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(String(event.data));
    if (msg.id) {
      const entry = pending.get(msg.id);
      if (!entry) {
        return;
      }
      pending.delete(msg.id);
      if (msg.error) {
        entry.reject(new Error(JSON.stringify(msg.error)));
      } else {
        entry.resolve(msg.result);
      }
      return;
    }
    const handlers = events.get(msg.method);
    if (!handlers) {
      return;
    }
    handlers.forEach((handler) => handler(msg.params));
  };

  const ready = new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  function send(method, params = {}) {
    const requestId = ++id;
    ws.send(JSON.stringify({ id: requestId, method, params }));
    return new Promise((resolve, reject) => {
      pending.set(requestId, { resolve, reject });
    });
  }

  function on(method, handler) {
    const handlers = events.get(method) ?? [];
    handlers.push(handler);
    events.set(method, handlers);
  }

  return { ws, ready, send, on };
}

function summarizeCpuProfile(profile, topN = 20) {
  const parentMap = new Map();
  for (const node of profile.nodes) {
    for (const child of node.children ?? []) {
      parentMap.set(child, node.id);
    }
  }
  const self = new Map();
  const total = new Map();
  const samples = profile.samples ?? [];
  const deltas = profile.timeDeltas ?? [];
  for (let i = 0; i < samples.length; i += 1) {
    const nodeId = samples[i];
    const delta = deltas[i] ?? 0;
    self.set(nodeId, (self.get(nodeId) ?? 0) + delta);
    let current = nodeId;
    while (current) {
      total.set(current, (total.get(current) ?? 0) + delta);
      current = parentMap.get(current);
    }
  }

  const rows = [];
  for (const node of profile.nodes) {
    const selfMs = (self.get(node.id) ?? 0) / 1000;
    const totalMs = (total.get(node.id) ?? 0) / 1000;
    if (selfMs === 0 && totalMs === 0) {
      continue;
    }
    const functionName = node.callFrame?.functionName || "(anonymous)";
    if (
      functionName === "(idle)" ||
      functionName === "(program)" ||
      functionName === "(garbage collector)"
    ) {
      continue;
    }
    rows.push({
      functionName,
      selfMs: round(selfMs),
      totalMs: round(totalMs),
      url: node.callFrame?.url || "",
      line: (node.callFrame?.lineNumber ?? -1) + 1,
    });
  }
  rows.sort((a, b) => b.selfMs - a.selfMs);
  return rows.slice(0, topN);
}

function makePayload(side, lines) {
  const chunks = [];
  chunks.push(`// ${side} generated payload (${lines} lines)`);
  for (let i = 1; i <= lines; i += 1) {
    const mod = i % 10;
    if (mod === 0) chunks.push(`function fn_${i}(v){ return v + ${i % 13}; }`);
    else if (mod === 1) chunks.push(`const row_${i} = "value_${side}_${i}";`);
    else if (mod === 2) chunks.push(`if (row_${i - 1}) { console.log(${i}); }`);
    else if (mod === 3) chunks.push(`<div class="box-${i % 31}" data-k="${i}">${side}_${i}</div>`);
    else if (mod === 4) chunks.push(`@: AppendLine("${side} ${i}");`);
    else if (mod === 5) chunks.push(`let total_${i} = (${i} * 7) - 3;`);
    else if (mod === 6) chunks.push(`for (let k = 0; k < 4; k++) { total_${i} += k; }`);
    else if (mod === 7) chunks.push(`section-${i}: alpha beta gamma delta epsilon`);
    else if (mod === 8) chunks.push(`/* block ${side} ${i} */`);
    else chunks.push(`@{ var x${i} = ${i}; }`);
  }
  return chunks.join("\n");
}

function getChromePath() {
  return process.env.CHROME_BIN || DEFAULT_CHROME;
}

function startDevServer(port) {
  const proc = spawn(
    "pnpm",
    ["run", "dev", "--host", "127.0.0.1", "--port", String(port)],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  const logs = [];
  proc.stdout.on("data", (chunk) => {
    logs.push(String(chunk));
    if (logs.length > 20) {
      logs.shift();
    }
  });
  proc.stderr.on("data", (chunk) => {
    logs.push(String(chunk));
    if (logs.length > 20) {
      logs.shift();
    }
  });
  return { proc, getRecentLogs: () => logs.join("") };
}

async function waitForSelector(cdp, selector, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await cdp.send("Runtime.evaluate", {
      expression: `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
      returnByValue: true,
    });
    if (result.result?.value === true) {
      return;
    }
    await sleep(100);
  }
  throw new Error(`Selector not found: ${selector}`);
}

async function setFileInput(cdp, selector, filePath) {
  const doc = await cdp.send("DOM.getDocument", { depth: -1, pierce: true });
  const node = await cdp.send("DOM.querySelector", {
    nodeId: doc.root.nodeId,
    selector,
  });
  if (!node.nodeId || node.nodeId <= 0) {
    throw new Error(`Node not found for selector: ${selector}`);
  }
  await cdp.send("DOM.setFileInputFiles", { nodeId: node.nodeId, files: [filePath] });
}

async function runProfile(cdp, label, expression, settleMs) {
  await cdp.send("Profiler.start");
  const start = performance.now();
  const action = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  await sleep(settleMs);
  const stopped = await cdp.send("Profiler.stop");
  const end = performance.now();
  return {
    label,
    wallMs: round(end - start),
    actionResult: action.result?.value ?? null,
    topSelf: summarizeCpuProfile(stopped.profile),
  };
}

async function runCaptureOnce(options) {
  const chromePort = 9300 + Math.floor(Math.random() * 500);
  const chromePath = getChromePath();
  const userDataDir = path.join(os.tmpdir(), `diff-viewer-perf-${Date.now()}-${Math.random()}`);
  const leftFile = path.join(os.tmpdir(), `diff-viewer-left-${Date.now()}.txt`);
  const rightFile = path.join(os.tmpdir(), `diff-viewer-right-${Date.now()}.txt`);
  const leftPayload = makePayload("left", options.lines);
  const rightPayload = makePayload("right", options.lines).replace(
    /value_right_(\d+)/g,
    (all, n) => (Number(n) % 6 === 0 ? `value_changed_${n}` : all),
  );
  writeFileSync(leftFile, leftPayload);
  writeFileSync(rightFile, rightPayload);

  const chrome = spawn(chromePath, [
    "--headless=new",
    `--remote-debugging-port=${chromePort}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-component-update",
    "--window-size=1440,900",
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "ignore"] });

  let cdp = null;
  try {
    await waitForDevTools(chromePort);
    const target = await fetchJson(
      `http://127.0.0.1:${chromePort}/json/new?${encodeURIComponent(`http://127.0.0.1:${options.port}/`)}`,
      { method: "PUT" },
    );
    cdp = createCdp(target.webSocketDebuggerUrl);
    await cdp.ready;
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("DOM.enable");
    await cdp.send("Profiler.enable");
    await cdp.send("Page.navigate", { url: `http://127.0.0.1:${options.port}/` });
    await sleep(2500);
    await waitForSelector(cdp, "#left-file");
    await waitForSelector(cdp, "#right-file");

    await setFileInput(cdp, "#left-file", leftFile);
    await sleep(1200);
    await setFileInput(cdp, "#right-file", rightFile);
    await sleep(2800);

    const recalc = await runProfile(
      cdp,
      "recalc-large",
      `(() => { document.querySelector('#recalc')?.click(); return true; })()`,
      options.settleMs,
    );
    await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const toggle = document.querySelector('#workspace-toggle');
        const create = document.querySelector('#workspace-create');
        toggle?.click();
        create?.click();
        toggle?.click();
        return true;
      })()`,
      returnByValue: true,
    });
    await sleep(500);
    const workspaceSwitch = await runProfile(
      cdp,
      "workspace-switch",
      `(() => {
        const toggle = document.querySelector('#workspace-toggle');
        toggle?.click();
        const buttons = [...document.querySelectorAll('.workspace-item .workspace-item__name')];
        const target = buttons[0];
        target?.click();
        toggle?.click();
        return { count: buttons.length, switched: Boolean(target) };
      })()`,
      options.settleMs,
    );
    return {
      lines: options.lines,
      recalc,
      workspaceSwitch,
    };
  } finally {
    if (cdp) {
      try {
        cdp.ws.close();
      } catch {
        // Ignore close errors.
      }
    }
    chrome.kill("SIGKILL");
    await Promise.allSettled([unlink(leftFile), unlink(rightFile)]);
  }
}

function resolveGitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function resolveChromeVersion(chromePath) {
  try {
    return execFileSync(chromePath, ["--version"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

async function runCapture(options) {
  const runCount = Math.max(1, options.runs);
  const runs = [];
  for (let i = 0; i < runCount; i += 1) {
    const one = await runCaptureOnce(options);
    runs.push(one);
    console.log(`capture run ${i + 1}/${runCount}: recalc=${one.recalc.wallMs}ms workspace=${one.workspaceSwitch.wallMs}ms`);
  }
  const recalcWalls = runs.map((run) => run.recalc.wallMs);
  const workspaceWalls = runs.map((run) => run.workspaceSwitch.wallMs);
  return {
    capturedAt: new Date().toISOString(),
    env: {
      os: `${os.type()} ${os.release()}`,
      node: process.version,
      chrome: resolveChromeVersion(getChromePath()),
      commit: resolveGitHead(),
    },
    config: options,
    runs,
    summary: {
      recalcWallMs: summary(recalcWalls),
      workspaceSwitchWallMs: summary(workspaceWalls),
    },
  };
}

function printCompare(before, after) {
  const bRecalc = before.summary?.recalcWallMs?.median ?? 0;
  const aRecalc = after.summary?.recalcWallMs?.median ?? 0;
  const bWorkspace = before.summary?.workspaceSwitchWallMs?.median ?? 0;
  const aWorkspace = after.summary?.workspaceSwitchWallMs?.median ?? 0;

  function deltaLine(label, b, a) {
    const delta = a - b;
    const pct = b === 0 ? 0 : (delta / b) * 100;
    console.log(`${label}: before=${round(b)}ms after=${round(a)}ms delta=${round(delta)}ms (${round(pct)}%)`);
  }

  console.log("Comparison (median wall time)");
  deltaLine("recalc", bRecalc, aRecalc);
  deltaLine("workspace-switch", bWorkspace, aWorkspace);
}

async function main() {
  const { command, options, positional } = parseArgs(process.argv.slice(2));
  if (!command || command === "--help" || command === "help") {
    usage();
    process.exit(0);
  }

  if (command === "compare") {
    if (positional.length < 2) {
      throw new Error("compare requires <before.json> <after.json>");
    }
    const before = JSON.parse(await readFile(positional[0], "utf8"));
    const after = JSON.parse(await readFile(positional[1], "utf8"));
    printCompare(before, after);
    return;
  }

  if (command !== "capture") {
    throw new Error(`Unknown command: ${command}`);
  }

  const captureOptions = {
    label: String(options.label ?? "capture"),
    lines: toNumber(options.lines, DEFAULT_LINES),
    runs: toNumber(options.runs, DEFAULT_RUNS),
    port: toNumber(options.port, DEFAULT_APP_PORT),
    settleMs: toNumber(options["settle-ms"], DEFAULT_SETTLE_MS),
    autoDev: Boolean(options["auto-dev"]),
  };

  const outFile =
    typeof options.out === "string"
      ? options.out
      : path.join(PERF_OUT_DIR, `${captureOptions.label}-${Date.now()}.json`);

  if (!existsSync(PERF_OUT_DIR)) {
    mkdirSync(PERF_OUT_DIR, { recursive: true });
  }

  let dev = null;
  if (captureOptions.autoDev) {
    dev = startDevServer(captureOptions.port);
    try {
      await waitForHttp(`http://127.0.0.1:${captureOptions.port}/`);
    } catch (error) {
      dev.proc.kill("SIGKILL");
      const logs = dev.getRecentLogs();
      throw new Error(`Failed to start dev server: ${String(error)}\n${logs}`);
    }
  } else {
    await waitForHttp(`http://127.0.0.1:${captureOptions.port}/`);
  }

  try {
    const result = await runCapture(captureOptions);
    writeFileSync(outFile, JSON.stringify(result, null, 2));
    console.log(`Saved: ${outFile}`);
  } finally {
    if (dev) {
      dev.proc.kill("SIGKILL");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
