import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.MANUAL_URL ?? "http://localhost:5173/";
const OUT_DIR = path.resolve("doc/manual-assets");

const leftText = `const project = "Diff Viewer";
const side = "left";
const items = ["alpha", "beta", "gamma"];

function sum(a, b) {
  return a + b;
}

console.log(items.join(", "));
// TODO: refactor
export { project, sum };
`;

const rightText = `const project = "Diff Viewer";
const side = "right";
const items = ["alpha", "beta", "delta"];

function sum(a, b) {
  return a - b;
}

console.log(items.join(", "));
// TODO: refactor
export { project, sum };
`;

const buildLines = (label, count) =>
  Array.from({ length: count }, (_, index) =>
    `// ${label} line ${index + 1}`,
  );

const multiFileSegments = [
  {
    startLine: 1,
    lineCount: 30,
    fileIndex: 1,
    fileName: "alpha.txt",
  },
  {
    startLine: 31,
    lineCount: 10,
    fileIndex: 2,
    fileName: "beta.txt",
  },
  {
    startLine: 41,
    lineCount: 10,
    fileIndex: 3,
    fileName: "gamma.txt",
  },
];

const multiFileText = [
  ...buildLines("alpha", 30),
  ...buildLines("beta", 10),
  ...buildLines("gamma", 10),
].join("\n");

const workspaceBase = (anchors, options = {}) => ({
  workspaces: [
    {
      id: "ws-main",
      name: "Workspace A",
      leftText: options.leftText ?? leftText,
      rightText: options.rightText ?? rightText,
      anchors,
    },
    {
      id: "ws-review",
      name: "Review",
      leftText: "const note = \"review\";\nconsole.log(note);\n",
      rightText: "const note = \"review\";\nconsole.log(note);\n",
      anchors: emptyAnchors(),
    },
    {
      id: "ws-sandbox",
      name: "Sandbox",
      leftText: "",
      rightText: "",
      anchors: emptyAnchors(),
    },
  ],
  selectedId: "ws-main",
});

function emptyAnchors() {
  return {
    manualAnchors: [],
    autoAnchor: null,
    suppressedAutoAnchorKey: null,
    pendingLeftLineNo: null,
    pendingRightLineNo: null,
    selectedAnchorKey: null,
  };
}

const anchorsWithSelection = {
  manualAnchors: [
    { leftLineNo: 1, rightLineNo: 1 },
    { leftLineNo: 5, rightLineNo: 5 },
  ],
  autoAnchor: null,
  suppressedAutoAnchorKey: null,
  pendingLeftLineNo: null,
  pendingRightLineNo: null,
  selectedAnchorKey: "manual:1:1",
};

const basePersistedState = {
  version: 1,
  leftText: "",
  rightText: "",
  leftEncoding: "auto",
  rightEncoding: "auto",
  scrollSync: true,
  foldEnabled: false,
  anchorPanelCollapsed: false,
  anchors: [],
  leftSegments: [],
  rightSegments: [],
};

const scenarios = [
  {
    name: "overview",
    workspaces: workspaceBase(emptyAnchors()),
    persistedState: basePersistedState,
    favoritePaths: {},
    theme: null,
    actions: async () => {},
  },
  {
    name: "diff",
    workspaces: workspaceBase(emptyAnchors()),
    persistedState: basePersistedState,
    favoritePaths: {},
    theme: null,
    actions: async () => {},
  },
  {
    name: "anchors",
    workspaces: workspaceBase(anchorsWithSelection),
    persistedState: basePersistedState,
    favoritePaths: {},
    theme: null,
    actions: async (page) => {
      await page.waitForSelector("#anchor-list .anchor-item");
    },
  },
  {
    name: "toggles",
    workspaces: workspaceBase(emptyAnchors()),
    persistedState: { ...basePersistedState, foldEnabled: true },
    favoritePaths: {},
    theme: null,
    actions: async (page) => {
      await page.waitForFunction(() => {
        const toggle = document.querySelector("#fold-toggle");
        return toggle && toggle.checked;
      });
    },
  },
  {
    name: "dark-theme",
    workspaces: workspaceBase(emptyAnchors()),
    persistedState: basePersistedState,
    favoritePaths: {},
    theme: "dark",
    actions: async () => {},
  },
  {
    name: "workspace",
    workspaces: workspaceBase(emptyAnchors()),
    persistedState: basePersistedState,
    favoritePaths: {},
    theme: null,
    actions: async (page) => {
      await page.click("#workspace-toggle");
      await page.waitForSelector("#workspace-panel:not([hidden])");
    },
  },
  {
    name: "paths",
    workspaces: workspaceBase(emptyAnchors()),
    persistedState: basePersistedState,
    favoritePaths: {
      "diffViewer.favoritePaths.left.ws-main": [
        "C:\\projects\\alpha\\left.txt",
        "C:\\projects\\alpha\\input.json",
        "C:\\projects\\alpha\\notes.md",
      ],
      "diffViewer.favoritePaths.right.ws-main": [
        "C:\\projects\\alpha\\right.txt",
        "C:\\projects\\alpha\\output.json",
      ],
    },
    theme: null,
    actions: async (page) => {
      await page.click("#left-favorite-add");
      await page.waitForSelector("#left-favorite-panel:not([hidden])");
      await page.waitForSelector("#left-favorite-paths .favorite-path");
    },
  },
  {
    name: "goto-line",
    workspaces: workspaceBase(emptyAnchors(), {
      leftText: multiFileText,
      rightText: multiFileText,
    }),
    persistedState: {
      ...basePersistedState,
      leftSegments: multiFileSegments,
      rightSegments: multiFileSegments,
    },
    favoritePaths: {},
    theme: null,
    actions: async (page) => {
      await page.keyboard.press("Control+G");
      await page.waitForSelector("#left-goto-line.is-open");
    },
  },
  {
    name: "file-card-jump",
    workspaces: workspaceBase(emptyAnchors(), {
      leftText: multiFileText,
      rightText: multiFileText,
    }),
    persistedState: {
      ...basePersistedState,
      leftSegments: multiFileSegments,
      rightSegments: multiFileSegments,
    },
    favoritePaths: {},
    theme: null,
    actions: async (page) => {
      await page.waitForSelector("#left-file-cards .file-card");
      await page.click('#left-file-cards .file-card[data-file="beta.txt"]');
      await page.waitForTimeout(200);
    },
  },
];

async function preparePage(page, payload) {
  await page.addInitScript((data) => {
    localStorage.clear();
    localStorage.setItem(
      "diffViewer.workspaces",
      JSON.stringify(data.workspaces),
    );
    localStorage.setItem(
      "diff-viewer:state",
      JSON.stringify(data.persistedState),
    );
    Object.entries(data.favoritePaths).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
    });
    if (data.theme) {
      localStorage.setItem("diff-viewer:theme", data.theme);
    }
  }, payload);

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("#left-editor .monaco-editor");
  await page.waitForSelector("#right-editor .monaco-editor");
}

await fs.mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

for (const scenario of scenarios) {
  await preparePage(page, scenario);
  await scenario.actions(page);
  await page.screenshot({
    path: path.join(OUT_DIR, `${scenario.name}.png`),
    fullPage: true,
  });
}

await browser.close();
