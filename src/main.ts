import "./style.css";
import "monaco-editor/min/vs/editor/editor.main.css";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import { resolveAppMode } from "./appMode";
import { createDiffEngine } from "./diffEngine/engine";
import { setupMonacoWorkers } from "./monaco/monacoWorkers";
import { registerBasicLanguages } from "./monaco/basicLanguages";
import { pairReplace } from "./diffEngine/pairReplace";
import { diffInlineWithAppendLiteral } from "./diffEngine/diffInline";
import type { PairedOp } from "./diffEngine/types";
import {
  prepareReplaceOpsForDisplay,
  type ReplaceDisplayDiff,
} from "./diffEngine/replaceVisibility";
import { ScrollSyncController } from "./scrollSync/ScrollSyncController";
import { getDiffBlockStarts, mapRowToLineNumbers } from "./diffEngine/diffBlocks";
import { type FileEncoding } from "./file/decode";
import {
  createLineNumberFormatter,
  getLineSegmentInfo,
  updateSegmentsForChanges,
  type LineSegment,
} from "./file/lineNumbering";
import {
  appendDecodedFiles,
  buildDecodedFiles,
  type FileBytes,
} from "./file/decodedFiles";
import {
  collectDroppedFiles,
  describeDecodedFileForWriteback,
  getPaneWriteAvailability,
  pickFilesWithHandles,
  readCurrentFileFromPaneTarget,
  resolveReloadEncodingForPaneTarget,
  requestFileHandlePermission,
  supportsFileSystemAccess,
  writeBytesToFileHandle,
  type FileSystemAccessWindow,
  type PaneSaveTarget,
  type ReadableFileHandle,
  type ReadableWritableFileHandle,
} from "./file/writeback";
import {
  areChangesWithinSingleFileSegments,
  buildMultiFileWritePlan,
} from "./file/multiFileEditModel";
import { pairFilesWithHandlesInDisplayOrder, reorderRazorPairs } from "./file/fileOrder";
import { buildFoldRanges, findFoldContainingRow, type FoldRange } from "./diffEngine/folding";
import {
  addAnchor,
  removeAnchorByLeft,
  removeAnchorByRight,
  validateAnchors,
  type Anchor,
} from "./diffEngine/anchors";
import { normalizeText } from "./diffEngine/normalize";
import { THIRD_PARTY_LICENSES } from "./licenses";
import { createAppTemplate } from "./ui/template";
import { setupAnchorPanelToggle } from "./ui/anchorPanelToggle";
import {
  bindPaneClearButton,
  clearEditorModel,
  clearEditorsForUndo,
  clearPaneState,
} from "./ui/paneClear";
import { buildAlignedFileBoundaryZones } from "./ui/fileBoundaryZones";
import { buildAnchorDecorations } from "./ui/anchorDecorations";
import { shouldApplyBySignature } from "./ui/renderSignatures";
import { handleAnchorShortcut } from "./ui/anchorShortcut";
import {
  handleLeftAnchorClick,
  handleRightAnchorClick,
  type AnchorClickResult,
} from "./ui/anchorClick";
import { resetAllAnchors } from "./ui/anchorReset";
import { getNextAnchorKey, resolveAnchorMoveDelta } from "./ui/anchorNavigation";
import { handleFindShortcut } from "./ui/editorFind";
import { handleGoToLineShortcut } from "./ui/goToLine";
import { handleGoToLineFileMoveShortcut, moveSelectedIndex } from "./ui/goToLineNavigation";
import { handlePaneFocusShortcut } from "./ui/paneFocusShortcut";
import { updateDiffJumpButtons } from "./ui/diffJumpButtons";
import { setupThemeToggle } from "./ui/themeToggle";
import { bindWordWrapShortcut } from "./ui/wordWrapShortcut";
import { bindSyntaxHighlightToggle } from "./ui/syntaxHighlightToggle";
import { bindIgnoreLeadingWhitespaceToggle } from "./ui/ignoreLeadingWhitespaceToggle";
import {
  bindPaneSourceCopyButton,
  buildCopyTextFromVisualRows,
  buildCopyVisualRowsFromAlignedDiff,
} from "./ui/paneSourceCopy";
import {
  bindExportReportButton,
  buildDiffReportHtml,
  buildReportRowsFromVisualRows,
  type DiffReportSyntaxRange,
  stripFileBoundaryLabelPrefix,
} from "./ui/diffReport";
import { bindReportModeMenu, type ReportMode } from "./ui/reportModeMenu";
import { createRecalcScheduler } from "./ui/recalcScheduler";
import { bindEditorLayoutRecalc } from "./ui/layoutRecalcWatcher";
import { bindPaneResize } from "./ui/paneResize";
import { buildFindWidgetOffsetZones } from "./ui/findWidgetOffset";
import { createEditorOptions } from "./ui/editorOptions";
import { renderFileCards, syncFileCards } from "./ui/fileCards";
import { bindFileCardJump } from "./ui/fileCardJump";
import { extractHtmlAttributeSpaceDiffRangesPair } from "./diffEngine/htmlAttributeSpaceDiff";
import { copyText } from "./ui/clipboard";
import { copyFavoritePath } from "./ui/favoriteCopy";
import {
  addFavoritePath,
  loadFavoritePaths,
  moveFavoritePath,
  removeFavoritePath,
  type FavoritePane,
  type FavoritePathResult,
} from "./storage/favoritePaths";
import {
  createWorkspace,
  loadWorkspaces,
  renameWorkspace,
  reorderWorkspaces,
  saveWorkspaces,
  setWorkspaceAnchors,
  setWorkspacePaneState,
  setWorkspaceTexts,
  WORKSPACE_LIMIT,
  WORKSPACE_NAME_LIMIT,
  type Workspace,
  type WorkspaceAnchorState,
  type WorkspacePaneState,
  type WorkspacesState,
} from "./storage/workspaces";
import {
  bindFavoritePathDragHandlers,
  bindFavoritePathHandlers,
  applyFavoritePathFocus,
  renderFavoritePaths,
} from "./ui/favoritePaths";
import {
  createFavoritePanelController,
  type FavoritePanelController,
} from "./ui/favoritePanel";
import { handleFavoritePanelShortcut } from "./ui/favoritePanelShortcut";
import { handleFileOpenShortcut } from "./ui/fileOpenShortcut";
import { handlePaneClearShortcut } from "./ui/paneClearShortcut";
import { handleThemeShortcut } from "./ui/themeShortcut";
import { handleHighlightShortcut } from "./ui/highlightShortcut";
import {
  clampFavoriteFocusIndex,
  handleFavoriteListKeydown,
} from "./ui/favoritePathNavigation";
import { focusFavoriteInputOnKey } from "./ui/favoritePanelKeyRouting";
import {
  bindWorkspaceDragHandlers,
  getWorkspaceAction,
  applyWorkspaceFocus,
  renderWorkspaces,
} from "./ui/workspaces";
import { createWorkspacePanelController } from "./ui/workspacePanel";
import { handleWorkspaceShortcut } from "./ui/workspaceShortcut";
import { removeWorkspaceWithConfirm } from "./ui/workspaceRemoval";
import { getWorkspaceTitle } from "./ui/workspaceTitle";
import { handleWorkspaceNavigation } from "./ui/workspaceNavigation";
import { runWorkspaceSwitch } from "./ui/workspaceSwitchFlow";
import {
  applyPaneSnapshot,
  collectPaneSnapshot,
  cloneSegments,
} from "./ui/workspacePaneState";
import { createToastManager } from "./ui/toast";
import {
  clearPersistedState,
  createPersistScheduler,
  loadPersistedState,
  saveInlinePersistedStateSnapshot,
  type PersistedState,
} from "./storage/persistedState";
import {
  isSegmentLayoutValid,
  resolveStartupWorkspaceRestore,
} from "./storage/startupRestore";
import { createIndexedDbTextStore } from "./storage/textStore";
import {
  clearPaneSaveTarget as clearStoredPaneSaveTarget,
  createIndexedDbPaneSaveTargetStore,
  loadPaneSaveTargets,
  savePaneSaveTargets,
} from "./storage/paneSaveTargets";
import { clearPaneSummary } from "./storage/paneSummary";
import {
  formatFileLoadError,
  shouldLogFileLoadError,
} from "./file/loadErrors";
import { runPostLoadTasks } from "./file/postLoad";
import { listLoadedFileNames } from "./file/loadMessages";
import {
  getFileSegment,
  getFileStartLine,
  getGlobalLineFromLocal,
} from "./file/segmentIndex";
import { clearPaneMessage, setPaneMessage, syncPaneMessages } from "./ui/paneMessages";
import { inferPaneLanguage } from "./file/language";
import { createDiffViewerPerfMonitor } from "./perf/runtimePerf";

// Run once before creating any editor instances.
setupMonacoWorkers();
registerBasicLanguages();

function attachLicenses(): void {
  if (document.getElementById("third-party-licenses")) {
    return;
  }
  const node = document.createElement("script");
  node.id = "third-party-licenses";
  node.type = "application/json";
  node.textContent = JSON.stringify({ thirdPartyLicenses: THIRD_PARTY_LICENSES });
  document.head.appendChild(node);
}

attachLicenses();

function getStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch (error) {
    console.warn("LocalStorage is not available:", error);
    return null;
  }
}

const storage = getStorage();
const textStore = createIndexedDbTextStore();
const persistedState = await loadPersistedState(storage, { textStore });
let persistScheduler: ReturnType<typeof createPersistScheduler> | null = null;
let persistSuppressed = false;
let suppressRecalc = false;
let workspacePersistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist() {
  if (persistSuppressed) {
    return;
  }
  persistScheduler?.schedule();
}

function cancelPersist() {
  persistScheduler?.cancel();
  cancelWorkspacePersist();
}

function scheduleWorkspacePersist() {
  if (!storage) {
    return;
  }
  if (workspacePersistTimer) {
    clearTimeout(workspacePersistTimer);
  }
  workspacePersistTimer = setTimeout(() => {
    workspacePersistTimer = null;
    persistWorkspacePaneState("left");
    persistWorkspacePaneState("right");
    const result = setWorkspaceAnchors(
      storage,
      workspaceState,
      workspaceState.selectedId,
      getCurrentAnchorState(),
      { textStore },
    );
    if (result.ok) {
      workspaceState = result.state;
    }
  }, 220);
}

function schedulePersistAll() {
  schedulePersist();
  scheduleWorkspacePersist();
}

function cancelWorkspacePersist() {
  if (workspacePersistTimer) {
    clearTimeout(workspacePersistTimer);
    workspacePersistTimer = null;
  }
}

function withPersistSuppressed(action: () => void) {
  persistSuppressed = true;
  try {
    action();
  } finally {
    persistSuppressed = false;
  }
}

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App container is missing.");
}

const appMode = resolveAppMode(window.location);
const writebackEnabled = appMode.writebackEnabled;
const diffEngine = await createDiffEngine({
  mode: appMode.diffEngineMode,
});
const diffViewerPerf = createDiffViewerPerfMonitor(() => diffEngine.getStatus());
window.__diffViewerPerf = diffViewerPerf;
app.innerHTML = createAppTemplate({
  writebackEnabled,
});
setupAnchorPanelToggle(document, {
  initialCollapsed: persistedState?.anchorPanelCollapsed ?? false,
  onToggle: () => schedulePersist(),
});

function getRequiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

const leftContainer = getRequiredElement<HTMLDivElement>("#left-editor");
const rightContainer = getRequiredElement<HTMLDivElement>("#right-editor");
const editorsContainer = getRequiredElement<HTMLDivElement>(".editors");
const paneDivider = getRequiredElement<HTMLDivElement>("#pane-divider");
const leftPane = getRequiredElement<HTMLElement>("#left-pane");
const rightPane = getRequiredElement<HTMLElement>("#right-pane");
const workspaceToggle = getRequiredElement<HTMLButtonElement>("#workspace-toggle");
const workspacePanel = getRequiredElement<HTMLDivElement>("#workspace-panel");
const workspaceOverlay = getRequiredElement<HTMLDivElement>("#workspace-overlay");
const workspaceList = getRequiredElement<HTMLDivElement>("#workspace-list");
const workspaceCreate = getRequiredElement<HTMLButtonElement>("#workspace-create");
const leftMessage = getRequiredElement<HTMLDivElement>("#left-message");
const rightMessage = getRequiredElement<HTMLDivElement>("#right-message");
const syncPaneMessagesLayout = (): void => {
  syncPaneMessages(leftMessage, rightMessage);
};
const showPaneMessage = (
  target: HTMLDivElement,
  message: string,
  isError: boolean,
): void => {
  setPaneMessage(target, message, isError);
  syncPaneMessagesLayout();
};
const resetPaneMessage = (target: HTMLDivElement): void => {
  clearPaneMessage(target);
  syncPaneMessagesLayout();
};
const leftFileCards = getRequiredElement<HTMLDivElement>("#left-file-cards");
const rightFileCards = getRequiredElement<HTMLDivElement>("#right-file-cards");
const syncFileCardsLayout = (): void => {
  syncFileCards(leftFileCards, rightFileCards);
};
const leftFavoriteAdd = getRequiredElement<HTMLButtonElement>("#left-favorite-add");
const rightFavoriteAdd = getRequiredElement<HTMLButtonElement>("#right-favorite-add");
const leftFavoriteOverlay =
  getRequiredElement<HTMLDivElement>("#left-favorite-overlay");
const rightFavoriteOverlay =
  getRequiredElement<HTMLDivElement>("#right-favorite-overlay");
const leftFavoritePanel = getRequiredElement<HTMLDivElement>("#left-favorite-panel");
const rightFavoritePanel = getRequiredElement<HTMLDivElement>("#right-favorite-panel");
const leftFavoriteInput = getRequiredElement<HTMLInputElement>("#left-favorite-input");
const rightFavoriteInput = getRequiredElement<HTMLInputElement>("#right-favorite-input");
const leftFavoriteSave = getRequiredElement<HTMLButtonElement>("#left-favorite-save");
const rightFavoriteSave = getRequiredElement<HTMLButtonElement>("#right-favorite-save");
const leftFavoriteCancel = getRequiredElement<HTMLButtonElement>("#left-favorite-cancel");
const rightFavoriteCancel = getRequiredElement<HTMLButtonElement>("#right-favorite-cancel");
const leftFavoriteError = getRequiredElement<HTMLDivElement>("#left-favorite-error");
const rightFavoriteError = getRequiredElement<HTMLDivElement>("#right-favorite-error");
const leftFavoritePaths = getRequiredElement<HTMLDivElement>("#left-favorite-paths");
const rightFavoritePaths = getRequiredElement<HTMLDivElement>("#right-favorite-paths");
const toastRoot = getRequiredElement<HTMLDivElement>("#toast-root");
const leftGotoPanel = getRequiredElement<HTMLDivElement>("#left-goto-line");
const rightGotoPanel = getRequiredElement<HTMLDivElement>("#right-goto-line");
const leftGotoFiles = getRequiredElement<HTMLDivElement>("#left-goto-line .goto-line-files");
const rightGotoFiles = getRequiredElement<HTMLDivElement>("#right-goto-line .goto-line-files");
const leftGotoInput = getRequiredElement<HTMLInputElement>("#left-goto-line-input");
const rightGotoInput = getRequiredElement<HTMLInputElement>("#right-goto-line-input");
const leftGotoHint = getRequiredElement<HTMLSpanElement>("#left-goto-line-hint");
const rightGotoHint = getRequiredElement<HTMLSpanElement>("#right-goto-line-hint");
const leftEncodingSelect = getRequiredElement<HTMLSelectElement>("#left-encoding");
const rightEncodingSelect = getRequiredElement<HTMLSelectElement>("#right-encoding");
const leftFileInput = getRequiredElement<HTMLInputElement>("#left-file");
const rightFileInput = getRequiredElement<HTMLInputElement>("#right-file");
const leftFileButton = getRequiredElement<HTMLButtonElement>("#left-file-button");
const rightFileButton = getRequiredElement<HTMLButtonElement>("#right-file-button");
const leftSaveFileButton = getRequiredElement<HTMLButtonElement>("#left-save-file");
const rightSaveFileButton = getRequiredElement<HTMLButtonElement>("#right-save-file");
const leftReloadFileButton = getRequiredElement<HTMLButtonElement>("#left-reload-file");
const rightReloadFileButton = getRequiredElement<HTMLButtonElement>("#right-reload-file");
const highlightToggleButton = document.querySelector<HTMLButtonElement>(
  "#highlight-toggle-button",
);
const highlightToggle = getRequiredElement<HTMLInputElement>("#highlight-toggle");
const themeToggle = document.querySelector<HTMLInputElement>("#theme-toggle");
const ignoreLeadingWhitespaceToggle = document.querySelector<HTMLInputElement>(
  "#ignore-leading-whitespace-toggle",
);
const anchorMessage = getRequiredElement<HTMLDivElement>("#anchor-message");
const anchorWarning = getRequiredElement<HTMLDivElement>("#anchor-warning");
const anchorList = getRequiredElement<HTMLUListElement>("#anchor-list");
const clearButton = getRequiredElement<HTMLButtonElement>("#clear");
const exportReportButton = getRequiredElement<HTMLButtonElement>("#export-report");
const reportModeToggleButton =
  getRequiredElement<HTMLButtonElement>("#report-mode-toggle");
const reportModeMenu = getRequiredElement<HTMLDivElement>("#report-mode-menu");
const reportModeSimpleButton =
  getRequiredElement<HTMLButtonElement>("#report-mode-simple");
const reportModeRichButton =
  getRequiredElement<HTMLButtonElement>("#report-mode-rich");
const leftCopyButton = getRequiredElement<HTMLButtonElement>("#left-copy");
const rightCopyButton = getRequiredElement<HTMLButtonElement>("#right-copy");
const leftClearButton = getRequiredElement<HTMLButtonElement>("#left-clear");
const rightClearButton = getRequiredElement<HTMLButtonElement>("#right-clear");
const prevButton = document.querySelector<HTMLButtonElement>("#diff-prev");
const nextButton = document.querySelector<HTMLButtonElement>("#diff-next");

applyEncodingSelection(leftEncodingSelect, persistedState?.leftEncoding);
applyEncodingSelection(rightEncodingSelect, persistedState?.rightEncoding);

let pendingWorkspaceToggle = false;
let requestWorkspaceToggle: (() => void) | null = null;

function isWorkspaceToggleShortcut(event: KeyboardEvent): boolean {
  if (!event.altKey || event.ctrlKey || event.metaKey) {
    return false;
  }
  return event.key.toLowerCase() === "n" || event.code === "KeyN";
}

function interceptWorkspaceToggleShortcut(event: KeyboardEvent) {
  if (!isWorkspaceToggleShortcut(event)) {
    return;
  }
  if (event.repeat) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  (event as KeyboardEvent & { returnValue?: boolean }).returnValue = false;
  (event as KeyboardEvent & { cancelBubble?: boolean }).cancelBubble = true;
  if (requestWorkspaceToggle) {
    requestWorkspaceToggle();
  } else {
    pendingWorkspaceToggle = true;
  }
}

window.addEventListener("keydown", interceptWorkspaceToggleShortcut, {
  capture: true,
});
document.addEventListener("keydown", interceptWorkspaceToggleShortcut, {
  capture: true,
});

let workspaceState: WorkspacesState = await loadWorkspaces(storage, { textStore });

const emptyWorkspaceAnchors: WorkspaceAnchorState = {
  manualAnchors: [],
  autoAnchor: null,
  suppressedAutoAnchorKey: null,
  pendingLeftLineNo: null,
  pendingRightLineNo: null,
  selectedAnchorKey: null,
};

function cloneWorkspaceAnchors(state: WorkspaceAnchorState): WorkspaceAnchorState {
  return {
    manualAnchors: state.manualAnchors.map((anchor) => ({ ...anchor })),
    autoAnchor: state.autoAnchor ? { ...state.autoAnchor } : null,
    suppressedAutoAnchorKey: state.suppressedAutoAnchorKey,
    pendingLeftLineNo: state.pendingLeftLineNo,
    pendingRightLineNo: state.pendingRightLineNo,
    selectedAnchorKey: state.selectedAnchorKey,
  };
}

function getSelectedWorkspace(state: WorkspacesState): Workspace | null {
  return (
    state.workspaces.find((workspace) => workspace.id === state.selectedId) ??
    state.workspaces[0] ??
    null
  );
}

let leftFavoriteList = loadFavoritePaths(
  storage,
  "left",
  workspaceState.selectedId,
);
let rightFavoriteList = loadFavoritePaths(
  storage,
  "right",
  workspaceState.selectedId,
);
const favoriteFocusIndex: Record<FavoritePane, number | null> = {
  left: null,
  right: null,
};
let editingWorkspaceId: string | null = null;
let focusedWorkspaceId: string | null = null;
const toast = createToastManager(toastRoot);

function setFavoriteError(target: HTMLDivElement, message: string) {
  target.textContent = message;
  target.classList.toggle("is-error", message.length > 0);
}

function getFavoritePaths(side: FavoritePane): string[] {
  return side === "left" ? leftFavoriteList : rightFavoriteList;
}

function setFavoritePaths(side: FavoritePane, paths: string[]) {
  if (side === "left") {
    leftFavoriteList = paths;
  } else {
    rightFavoriteList = paths;
  }
}

function getFavoriteList(side: FavoritePane): HTMLDivElement {
  return side === "left" ? leftFavoritePaths : rightFavoritePaths;
}

function focusFavoriteItem(side: FavoritePane, index: number) {
  const list = getFavoriteList(side);
  const target = list.querySelector<HTMLElement>(
    `.favorite-path[data-index="${index}"]`,
  );
  target?.focus();
}

function renderFavoriteList(
  side: FavoritePane,
  options?: { focusItem?: boolean },
) {
  const paths = getFavoritePaths(side);
  const list = getFavoriteList(side);
  const nextIndex = clampFavoriteFocusIndex(
    favoriteFocusIndex[side],
    paths.length,
  );
  favoriteFocusIndex[side] = nextIndex;
  renderFavoritePaths(list, paths, { focusedIndex: nextIndex });
  if (options?.focusItem && nextIndex !== null) {
    focusFavoriteItem(side, nextIndex);
  }
}

function setFavoriteFocus(
  side: FavoritePane,
  nextIndex: number | null,
  options?: { focusItem?: boolean },
) {
  const paths = getFavoritePaths(side);
  const list = getFavoriteList(side);
  const clamped = clampFavoriteFocusIndex(nextIndex, paths.length);
  favoriteFocusIndex[side] = clamped;
  applyFavoritePathFocus(list, clamped);
  if (options?.focusItem && clamped !== null) {
    focusFavoriteItem(side, clamped);
  }
}

function adjustFavoriteFocusAfterRemove(
  currentIndex: number | null,
  removedIndex: number,
  nextLength: number,
): number | null {
  if (nextLength <= 0) {
    return null;
  }
  if (currentIndex === null) {
    return null;
  }
  if (currentIndex > removedIndex) {
    return currentIndex - 1;
  }
  return Math.min(currentIndex, nextLength - 1);
}

function adjustFavoriteFocusAfterMove(
  currentIndex: number | null,
  fromIndex: number,
  toIndex: number,
): number | null {
  if (currentIndex === null) {
    return null;
  }
  if (currentIndex === fromIndex) {
    return toIndex;
  }
  if (fromIndex < currentIndex && currentIndex <= toIndex) {
    return currentIndex - 1;
  }
  if (toIndex <= currentIndex && currentIndex < fromIndex) {
    return currentIndex + 1;
  }
  return currentIndex;
}

function setWorkspaceTitle(state: WorkspacesState) {
  workspaceToggle.textContent = getWorkspaceTitle(state);
}

function focusWorkspaceItem(id: string) {
  const item = workspaceList.querySelector<HTMLElement>(
    `.workspace-item[data-id="${id}"]`,
  );
  if (!item) {
    return;
  }
  const input = item.querySelector<HTMLInputElement>(".workspace-item__input");
  if (input) {
    input.focus();
    return;
  }
  const nameButton = item.querySelector<HTMLButtonElement>(
    ".workspace-item__name",
  );
  if (nameButton) {
    nameButton.focus();
    return;
  }
  const fallback = item.querySelector<HTMLButtonElement>("button");
  fallback?.focus();
}

function setWorkspaceFocus(
  nextId: string | null,
  options?: { focusItem?: boolean },
) {
  focusedWorkspaceId = nextId;
  applyWorkspaceFocus(workspaceList, focusedWorkspaceId);
  if (options?.focusItem && nextId) {
    focusWorkspaceItem(nextId);
  }
}

function renderWorkspacePanel(options?: {
  focusInput?: boolean;
  focusItemId?: string | null;
}) {
  if (options?.focusInput && editingWorkspaceId) {
    focusedWorkspaceId = editingWorkspaceId;
  }
  renderWorkspaces(workspaceList, workspaceState.workspaces, {
    selectedId: workspaceState.selectedId,
    editingId: editingWorkspaceId,
    focusedId: focusedWorkspaceId,
  });
  workspaceCreate.disabled = workspaceState.workspaces.length >= WORKSPACE_LIMIT;
  setWorkspaceTitle(workspaceState);
  if (options?.focusInput && editingWorkspaceId) {
    const input = workspaceList.querySelector<HTMLInputElement>(
      `.workspace-item[data-id="${editingWorkspaceId}"] .workspace-item__input`,
    );
    if (input) {
      input.focus();
      input.select();
    }
  }
  if (options?.focusItemId) {
    setWorkspaceFocus(options.focusItemId, { focusItem: true });
  }
}

function loadFavoriteListsForWorkspace(workspaceId: string) {
  setFavoritePaths("left", loadFavoritePaths(storage, "left", workspaceId));
  setFavoritePaths("right", loadFavoritePaths(storage, "right", workspaceId));
  favoriteFocusIndex.left = null;
  favoriteFocusIndex.right = null;
  renderFavoriteList("left");
  renderFavoriteList("right");
}

function persistCurrentWorkspaceState() {
  persistWorkspacePaneState("left");
  persistWorkspacePaneState("right");
  const result = setWorkspaceAnchors(
    storage,
    workspaceState,
    workspaceState.selectedId,
    getCurrentAnchorState(),
    { textStore },
  );
  if (result.ok) {
    workspaceState = result.state;
  }
}

function persistWorkspacePaneState(side: "left" | "right") {
  const result = setWorkspacePaneState(
    storage,
    workspaceState,
    workspaceState.selectedId,
    side,
    collectWorkspacePaneSnapshot(side),
    { textStore },
  );
  if (result.ok) {
    workspaceState = result.state;
  }
}

function applyWorkspaceAnchors(anchors: WorkspaceAnchorState) {
  manualAnchors = anchors.manualAnchors.map((anchor) => ({ ...anchor }));
  autoAnchor = anchors.autoAnchor ? { ...anchors.autoAnchor } : null;
  suppressedAutoAnchorKey = anchors.suppressedAutoAnchorKey;
  pendingLeftLineNo = anchors.pendingLeftLineNo;
  pendingRightLineNo = anchors.pendingRightLineNo;
  selectedAnchorKey = anchors.selectedAnchorKey;
  updatePendingAnchorDecoration();
  setAnchorMessage("");
}

function applyWorkspaceState(
  nextState: WorkspacesState,
  options?: { focusInput?: boolean },
) {
  const previousSelectedId = workspaceState.selectedId;
  workspaceState = nextState;
  renderWorkspacePanel(options);
  if (nextState.selectedId !== previousSelectedId) {
    loadFavoriteListsForWorkspace(nextState.selectedId);
    const selected = getSelectedWorkspace(workspaceState);
    if (selected) {
      applyWorkspacePaneSnapshot("left", getWorkspacePaneSnapshot(selected, "left"), {
        applyText: true,
      });
      applyWorkspacePaneSnapshot("right", getWorkspacePaneSnapshot(selected, "right"), {
        applyText: true,
      });
      refreshSyntaxHighlight();
      clearPaneSourceState("left", { persistSaveTarget: false });
      clearPaneSourceState("right", { persistSaveTarget: false });
      resetPaneMessage(leftMessage);
      resetPaneMessage(rightMessage);
      clearPaneSummary(storage, "left");
      clearPaneSummary(storage, "right");
      applyWorkspaceAnchors(selected.anchors);
      void restorePaneSaveTargetsForWorkspace(nextState.selectedId);
      anchorUndoState = null;
      recalcScheduler.runNow();
      schedulePersistAll();
    }
  }
}

function switchWorkspaceById(
  id: string,
  options?: { focusItem?: boolean },
) {
  if (id === workspaceState.selectedId) {
    return;
  }
  if (options?.focusItem) {
    focusedWorkspaceId = id;
  }
  let result = setWorkspacePaneState(
    storage,
    workspaceState,
    workspaceState.selectedId,
    "left",
    collectWorkspacePaneSnapshot("left"),
    { textStore },
  );
  if (result.ok) {
    workspaceState = result.state;
  }
  result = setWorkspacePaneState(
    storage,
    workspaceState,
    workspaceState.selectedId,
    "right",
    collectWorkspacePaneSnapshot("right"),
    { textStore },
  );
  if (result.ok) {
    workspaceState = result.state;
  }
  const currentAnchors = getCurrentAnchorState();
  const nextState = runWorkspaceSwitch(
    workspaceState,
    id,
    {
      left: {
        getValue: () => leftEditor.getValue(),
        setValue: (value) =>
          withProgrammaticEdit("left", () => {
            leftEditor.setValue(value);
          }),
      },
      right: {
        getValue: () => rightEditor.getValue(),
        setValue: (value) =>
          withProgrammaticEdit("right", () => {
            rightEditor.setValue(value);
          }),
      },
    },
    currentAnchors,
    {
      onAfterRestore: (_stateAfter, target) => {
        applyWorkspacePaneSnapshot("left", getWorkspacePaneSnapshot(target, "left"), {
          applyText: false,
        });
        applyWorkspacePaneSnapshot("right", getWorkspacePaneSnapshot(target, "right"), {
          applyText: false,
        });
        refreshSyntaxHighlight();
        clearPaneSourceState("left");
        clearPaneSourceState("right");
        resetPaneMessage(leftMessage);
        resetPaneMessage(rightMessage);
        clearPaneSummary(storage, "left");
        clearPaneSummary(storage, "right");
        applyWorkspaceAnchors(target.anchors);
      },
      onAfterSwitch: () => {
        anchorUndoState = null;
        recalcScheduler.runNow();
        schedulePersist();
      },
    },
  );
  if (nextState.selectedId === workspaceState.selectedId) {
    return;
  }
  workspaceState = nextState;
  void saveWorkspaces(storage, workspaceState, { textStore });
  renderWorkspacePanel({
    focusItemId: options?.focusItem ? id : null,
  });
  loadFavoriteListsForWorkspace(workspaceState.selectedId);
  scheduleWorkspacePersist();
}

function handleWorkspaceRename(id: string, rawName: string) {
  const result = renameWorkspace(storage, workspaceState, id, rawName, { textStore });
  if (!result.ok) {
    const message =
      result.reason === "empty"
        ? "名前を入力してください"
        : result.reason === "length"
          ? `名前は${WORKSPACE_NAME_LIMIT}文字以内です`
          : "名前を変更できません";
    toast.show(message, "error");
    editingWorkspaceId = null;
    renderWorkspacePanel();
    return;
  }
  workspaceState = result.state;
  editingWorkspaceId = null;
  renderWorkspacePanel();
}

function handleFavoriteAddResult(
  side: FavoritePane,
  result: FavoritePathResult,
) {
  if (!result.ok) {
    const message =
      result.reason === "empty"
        ? "パスを入力してください"
        : result.reason === "duplicate"
          ? "同じパスが登録されています"
          : "最大10件まで登録できます";
    toast.show(message, "error");
    return false;
  }
  setFavoritePaths(side, result.paths);
  renderFavoriteList(side);
  toast.show("パスを追加しました");
  return true;
}

function bindFavoritePane(
  side: FavoritePane,
  options: {
    input: HTMLInputElement;
    saveButton: HTMLButtonElement;
    error: HTMLDivElement;
    list: HTMLDivElement;
  },
) {
  const { input, saveButton, error, list } = options;

  const getWorkspaceId = () => workspaceState.selectedId;
  const getPaths = () => getFavoritePaths(side);
  const setPaths = (paths: string[]) => setFavoritePaths(side, paths);

  const handleAdd = () => {
    const current = getPaths();
    const result = addFavoritePath(
      storage,
      side,
      getWorkspaceId(),
      current,
      input.value,
    );
    const ok = handleFavoriteAddResult(side, result);
    if (ok) {
      input.value = "";
      input.focus();
      setFavoriteError(error, "");
    }
  };

  saveButton.addEventListener("click", handleAdd);

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAdd();
    }
  });

  bindFavoritePathHandlers(list, async (action) => {
    const paths = getPaths();
    if (action.type === "copy") {
      await copyFavoritePath({
        path: action.path,
        doc: document,
        copy: copyText,
        toast,
        onSuccess: () => closeFavoritePanel(side),
      });
      return;
    }

    let next = paths;
    if (action.type === "remove") {
      next = removeFavoritePath(
        storage,
        side,
        getWorkspaceId(),
        paths,
        action.index,
      );
    }

    if (next !== paths) {
      setPaths(next);
      favoriteFocusIndex[side] = adjustFavoriteFocusAfterRemove(
        favoriteFocusIndex[side],
        action.index,
        next.length,
      );
      renderFavoriteList(side, { focusItem: true });
      setFavoriteError(error, "");
    }
  });

  bindFavoritePathDragHandlers(list, (move) => {
    const paths = getPaths();
    const next = moveFavoritePath(
      storage,
      side,
      getWorkspaceId(),
      paths,
      move.from,
      move.to,
    );
    if (next === paths) {
      return;
    }
    setPaths(next);
    favoriteFocusIndex[side] = adjustFavoriteFocusAfterMove(
      favoriteFocusIndex[side],
      move.from,
      move.to,
    );
    renderFavoriteList(side, { focusItem: true });
    setFavoriteError(error, "");
  });

  list.addEventListener("click", (event) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>(
      ".favorite-path",
    );
    if (!item) {
      return;
    }
    const index = Number(item.dataset.index);
    if (!Number.isFinite(index)) {
      return;
    }
    setFavoriteFocus(side, index, { focusItem: true });
  });

  list.addEventListener("keydown", (event) => {
    const paths = getPaths();
    handleFavoriteListKeydown(event, {
      length: paths.length,
      currentIndex: favoriteFocusIndex[side],
      onMove: (nextIndex) => {
        setFavoriteFocus(side, nextIndex, { focusItem: true });
      },
      onCopy: async (index) => {
        const path = paths[index] ?? "";
        if (!path) {
          toast.show("コピー対象がありません", "error");
          return;
        }
        await copyFavoritePath({
          path,
          doc: document,
          copy: copyText,
          toast,
          onSuccess: () => closeFavoritePanel(side),
        });
      },
      onRemove: (index) => {
        const current = getPaths();
        const next = removeFavoritePath(
          storage,
          side,
          getWorkspaceId(),
          current,
          index,
        );
        if (next === current) {
          return;
        }
        setPaths(next);
        favoriteFocusIndex[side] = adjustFavoriteFocusAfterRemove(
          favoriteFocusIndex[side],
          index,
          next.length,
        );
        renderFavoriteList(side, { focusItem: true });
        setFavoriteError(error, "");
      },
    });
  });
}

const leftSample = `// Left sample (47 lines)
const config = {
  app: "diff-viewer",
  version: "0.1.0",
  features: ["diff", "anchors", "folding"],
};

function greet(name) {
  return "Hello, " + name;
}

function add(a, b) {
  return a + b;
}

function sumList(values) {
  return values.reduce((total, value) => total + value, 0);
}

function format(value) {
  return \`[\${value}]\`;
}

const numbers = [1, 2, 3, 4];
const total = sumList(numbers);

const message = greet("World");
const count = add(2, 3);

const output = [];
output.push(format(message));
output.push(format(total));

if (count > 3) {
  console.log(output.join(" | "));
} else {
  console.log("Small count");
}

for (let i = 0; i < 3; i += 1) {
  console.log("step", i);
}

const flags = new Map();
flags.set("ready", true);

export { config, greet, add, sumList };
`;

const rightSample = `// Right sample (47 lines)
const config = {
  app: "diff-viewer",
  version: "0.1.1",
  features: ["diff", "anchors", "folding", "drop"],
};

function greet(name) {
  return "Hello, " + name + "!";
}

function add(a, b) {
  return a + b;
}

function sumList(values) {
  return values.reduce((total, value) => total + value, 0);
}

function format(value) {
  return \`{\${value}}\`;
}

const numbers = [1, 2, 3, 4, 5];
const total = sumList(numbers);

const message = greet("Codex");
const count = add(2, 4);

const output = [];
output.push(format(message));
output.push(format(total));

if (count > 3) {
  console.log(output.join(" / "));
} else {
  console.log("Small count");
}

for (let i = 0; i < 4; i += 1) {
  console.log("step", i);
}

const flags = new Map();
flags.set("ready", true);

export { config, greet, add, sumList };
`;

const selectedWorkspace = getSelectedWorkspace(workspaceState);
const startupRestore = resolveStartupWorkspaceRestore({
  workspaceState,
  persistedState,
  emptyAnchorState: emptyWorkspaceAnchors,
});
const seedLeft = persistedState?.leftText || leftSample;
const seedRight = persistedState?.rightText || rightSample;
const leftInitial = startupRestore.leftPane.text || seedLeft;
const rightInitial = startupRestore.rightPane.text || seedRight;
const leftInitialSegments = cloneSegments(startupRestore.leftPane.segments);
const rightInitialSegments = cloneSegments(startupRestore.rightPane.segments);

if (selectedWorkspace) {
  if (startupRestore.shouldPersistLeftPane) {
    const result = setWorkspacePaneState(
      storage,
      workspaceState,
      selectedWorkspace.id,
      "left",
      startupRestore.leftPane,
      { textStore },
    );
    if (result.ok) {
      workspaceState = result.state;
    }
  }
  if (startupRestore.shouldPersistRightPane) {
    const result = setWorkspacePaneState(
      storage,
      workspaceState,
      selectedWorkspace.id,
      "right",
      startupRestore.rightPane,
      { textStore },
    );
    if (result.ok) {
      workspaceState = result.state;
    }
  }
}

const leftEditor = monaco.editor.create(
  leftContainer,
  createEditorOptions(leftInitial),
);

const rightEditor = monaco.editor.create(
  rightContainer,
  createEditorOptions(rightInitial),
);

const INDENT_OPTIONS: monaco.editor.ITextModelUpdateOptions &
  monaco.editor.IEditorOptions = {
  tabSize: 4,
  insertSpaces: true,
  detectIndentation: false,
};

function applyIndentOptions(
  editor: monaco.editor.IStandaloneCodeEditor,
): void {
  editor.updateOptions(INDENT_OPTIONS);
  const model = editor.getModel();
  if (model) {
    model.updateOptions(INDENT_OPTIONS);
  }
}

applyIndentOptions(leftEditor);
applyIndentOptions(rightEditor);

bindAnchorUndoHandler(leftEditor, "left");
bindAnchorUndoHandler(rightEditor, "right");

function enableBrowserZoomOnCtrlWheel(target: HTMLElement | null) {
  if (!target) {
    return;
  }
  target.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey) {
        // Let the browser handle zoom when Ctrl+wheel is used.
        event.stopPropagation();
      }
    },
    { capture: true },
  );
}

enableBrowserZoomOnCtrlWheel(leftContainer);
enableBrowserZoomOnCtrlWheel(rightContainer);

let wordWrapEnabled = false;
bindWordWrapShortcut({
  editors: [leftEditor, rightEditor],
  getEnabled: () => wordWrapEnabled,
  setEnabled: (next) => {
    wordWrapEnabled = next;
  },
  onAfterToggle: () => recalcDiff(),
  keyTarget: window,
});

const getPaneLanguage = (segments: LineSegment[]) =>
  inferPaneLanguage(listLoadedFileNames(segments));

const syntaxHighlightController = bindSyntaxHighlightToggle({
  input: highlightToggle,
  button: highlightToggleButton,
  editors: [leftEditor, rightEditor],
  getLanguageForEditor: (index) =>
    index === 0 ? getPaneLanguage(leftSegments) : getPaneLanguage(rightSegments),
  setModelLanguage: (model, language) => {
    monaco.editor.setModelLanguage(model as monaco.editor.ITextModel, language);
  },
  onAfterToggle: () => {
    invalidateDiffRendering();
  },
});

const refreshSyntaxHighlight = () => {
  syntaxHighlightController?.applyHighlight(highlightToggle.checked);
};

function toggleTheme(): void {
  if (!themeToggle) {
    return;
  }
  themeToggle.checked = !themeToggle.checked;
  const view = themeToggle.ownerDocument?.defaultView;
  const changeEvent = view
    ? new view.Event("change", { bubbles: true })
    : new Event("change");
  themeToggle.dispatchEvent(changeEvent);
}

function toggleHighlight(): void {
  if (!highlightToggle) {
    return;
  }
  highlightToggle.checked = !highlightToggle.checked;
  const view = highlightToggle.ownerDocument?.defaultView;
  const changeEvent = view
    ? new view.Event("change", { bubbles: true })
    : new Event("change");
  highlightToggle.dispatchEvent(changeEvent);
}

const recalcScheduler = createRecalcScheduler(() => recalcDiff(), 200);
const scheduleRecalc = () => {
  if (suppressRecalc) {
    return;
  }
  recalcScheduler.schedule();
};

syncPaneMessagesLayout();
syncFileCardsLayout();
window.addEventListener("resize", syncPaneMessagesLayout);
bindEditorLayoutRecalc([leftEditor, rightEditor], scheduleRecalc);
bindPaneResize({
  container: editorsContainer,
  divider: paneDivider,
  editors: [leftEditor, rightEditor],
  onAfterResize: () => {
    syncPaneMessagesLayout();
    syncFileCardsLayout();
    scheduleRecalc();
  },
});

let lastFocusedSide: "left" | "right" = "left";
const leftFileBytes: FileBytes[] = [];
const rightFileBytes: FileBytes[] = [];
let suppressLeftFileBytesClear = false;
let suppressRightFileBytesClear = false;
const paneSaveTargets: Record<"left" | "right", PaneSaveTarget | null> = {
  left: null,
  right: null,
};
const paneSaveTargetLists: Record<"left" | "right", PaneSaveTarget[]> = {
  left: [],
  right: [],
};
const paneSavePending: Record<"left" | "right", boolean> = {
  left: false,
  right: false,
};
const paneReloadPending: Record<"left" | "right", boolean> = {
  left: false,
  right: false,
};

function clonePaneSaveTarget(target: PaneSaveTarget | null): PaneSaveTarget | null {
  if (!target) {
    return null;
  }
  return {
    handle: target.handle,
    fileName: target.fileName,
    resolvedEncoding: target.resolvedEncoding,
    includeUtf8Bom: target.includeUtf8Bom,
    lineEnding: target.lineEnding,
  };
}

function clonePaneSaveTargets(targets: readonly PaneSaveTarget[]): PaneSaveTarget[] {
  return targets
    .map((target) => clonePaneSaveTarget(target))
    .filter((target): target is PaneSaveTarget => target !== null);
}

function isReadableWritableFileHandle(
  handle: ReadableFileHandle,
): handle is ReadableWritableFileHandle {
  return typeof (handle as { createWritable?: unknown }).createWritable === "function";
}

type WritablePaneSaveTarget = PaneSaveTarget & {
  handle: ReadableWritableFileHandle;
};

function hasWritablePaneHandle(target: PaneSaveTarget): target is WritablePaneSaveTarget {
  return isReadableWritableFileHandle(target.handle);
}

const paneBoundarySnapshots: Record<
  "left" | "right",
  { text: string; segments: LineSegment[] }
> = {
  left: { text: "", segments: [] },
  right: { text: "", segments: [] },
};
let diffRenderingInvalidated = false;

function cloneSegmentsForSnapshot(segments: readonly LineSegment[]): LineSegment[] {
  return segments.map((segment) => ({ ...segment }));
}

function commitPaneBoundarySnapshot(side: "left" | "right"): void {
  const editor = side === "left" ? leftEditor : rightEditor;
  const segments = side === "left" ? leftSegments : rightSegments;
  paneBoundarySnapshots[side] = {
    text: editor.getValue(),
    segments: cloneSegmentsForSnapshot(segments),
  };
}

function invalidateDiffRendering(): void {
  diffRenderingInvalidated = true;
}

function withProgrammaticEdit(
  side: "left" | "right",
  action: () => void,
): void {
  suppressRecalc = true;
  if (side === "left") {
    suppressLeftFileBytesClear = true;
  } else {
    suppressRightFileBytesClear = true;
  }
  try {
    action();
  } finally {
    if (side === "left") {
      suppressLeftFileBytesClear = false;
    } else {
      suppressRightFileBytesClear = false;
    }
    suppressRecalc = false;
    invalidateDiffRendering();
  }
}

function updateFileCards(
  side: "left" | "right",
  names: readonly string[],
): void {
  const target = side === "left" ? leftFileCards : rightFileCards;
  renderFileCards(target, names);
  syncFileCardsLayout();
}

function getOpenFavoriteSide(): FavoritePane | null {
  if (leftFavoriteController.isOpen()) {
    return "left";
  }
  if (rightFavoriteController.isOpen()) {
    return "right";
  }
  return null;
}

function closeFavoritePanel(side: FavoritePane): void {
  if (side === "left") {
    leftFavoriteController.close();
  } else {
    rightFavoriteController.close();
  }
}

type GoToLinePane = {
  root: HTMLDivElement;
  files: HTMLDivElement;
  input: HTMLInputElement;
  hint: HTMLSpanElement;
};

const goToLinePanes: Record<"left" | "right", GoToLinePane> = {
  left: {
    root: leftGotoPanel,
    files: leftGotoFiles,
    input: leftGotoInput,
    hint: leftGotoHint,
  },
  right: {
    root: rightGotoPanel,
    files: rightGotoFiles,
    input: rightGotoInput,
    hint: rightGotoHint,
  },
};

const goToLineSelection: Record<"left" | "right", string | null> = {
  left: null,
  right: null,
};

function getPaneSegments(side: "left" | "right"): LineSegment[] {
  return side === "left" ? leftSegments : rightSegments;
}

function getPaneEditor(side: "left" | "right"): monaco.editor.IStandaloneCodeEditor {
  return side === "left" ? leftEditor : rightEditor;
}

function applyWorkspacePaneSnapshot(
  side: "left" | "right",
  snapshot: WorkspacePaneState,
  options?: { applyText?: boolean },
): void {
  const editor = getPaneEditor(side);
  const segments = getPaneSegments(side);
  const baseText = options?.applyText === false ? editor.getValue() : snapshot.text;
  const safeSnapshot = {
    ...snapshot,
    segments: isSegmentLayoutValid(snapshot.segments, baseText)
      ? snapshot.segments
      : [],
  };
  applyPaneSnapshot(
    {
      getValue: () => editor.getValue(),
      setValue: (value) =>
        withProgrammaticEdit(side, () => {
          editor.setValue(value);
        }),
      getPosition: () => editor.getPosition(),
      setPosition: (position) => editor.setPosition(position),
      getScrollTop: () => editor.getScrollTop(),
      setScrollTop: (value) => editor.setScrollTop(value),
      getLineCount: () => editor.getModel()?.getLineCount() ?? 1,
    },
    segments,
    safeSnapshot,
    options,
  );
  updateLineNumbers(editor, segments);
  applyIndentOptions(editor);
  commitPaneBoundarySnapshot(side);
  const fileNames = listLoadedFileNames(segments);
  updateFileCards(side, fileNames);
  let activeFile = safeSnapshot.activeFile;
  if (activeFile && !fileNames.includes(activeFile)) {
    activeFile = fileNames[0] ?? null;
  }
  setGoToLineSelection(side, activeFile, { persist: false });
}

function collectWorkspacePaneSnapshot(side: "left" | "right"): WorkspacePaneState {
  const editor = getPaneEditor(side);
  const segments = getPaneSegments(side);
  return collectPaneSnapshot(
    {
      getValue: () => editor.getValue(),
      setValue: (value) =>
        withProgrammaticEdit(side, () => {
          editor.setValue(value);
        }),
      getPosition: () => editor.getPosition(),
      setPosition: (position) => editor.setPosition(position),
      getScrollTop: () => editor.getScrollTop(),
      setScrollTop: (value) => editor.setScrollTop(value),
      getLineCount: () => editor.getModel()?.getLineCount() ?? 1,
    },
    segments,
    goToLineSelection[side],
  );
}

function getWorkspacePaneSnapshot(
  workspace: Workspace,
  side: "left" | "right",
): WorkspacePaneState {
  if (side === "left") {
    return {
      text: workspace.leftText,
      segments: cloneSegments(workspace.leftSegments ?? []),
      activeFile: workspace.leftActiveFile ?? null,
      cursor: workspace.leftCursor ?? null,
      scrollTop: workspace.leftScrollTop ?? null,
    };
  }
  return {
    text: workspace.rightText,
    segments: cloneSegments(workspace.rightSegments ?? []),
    activeFile: workspace.rightActiveFile ?? null,
    cursor: workspace.rightCursor ?? null,
    scrollTop: workspace.rightScrollTop ?? null,
  };
}

function getEditorAlternativeVersionId(
  editor: monaco.editor.IStandaloneCodeEditor,
): number | null {
  const model = editor.getModel();
  const modelWithAlt = model as monaco.editor.ITextModel & {
    getAlternativeVersionId?: () => number;
  };
  return modelWithAlt?.getAlternativeVersionId?.() ?? null;
}

function captureAnchorSnapshot(): AnchorSnapshot {
  return {
    manualAnchors: manualAnchors.map((anchor) => ({ ...anchor })),
    suppressedAutoAnchorKey,
    pendingLeftLineNo,
    pendingRightLineNo,
    selectedAnchorKey,
  };
}

function restoreAnchorsFromSnapshot(snapshot: AnchorSnapshot) {
  manualAnchors = snapshot.manualAnchors.map((anchor) => ({ ...anchor }));
  suppressedAutoAnchorKey = snapshot.suppressedAutoAnchorKey;
  pendingLeftLineNo = snapshot.pendingLeftLineNo;
  pendingRightLineNo = snapshot.pendingRightLineNo;
  selectedAnchorKey = snapshot.selectedAnchorKey;
  recalcDiff();
  schedulePersistAll();
}

function clearUndoMetaForSide(side: "left" | "right"): ClearUndoPaneState | null {
  if (!clearUndoState) {
    return null;
  }
  return side === "left" ? clearUndoState.left : clearUndoState.right;
}

function clearUndoMetaForOther(side: "left" | "right"): ClearUndoPaneState | null {
  if (!clearUndoState) {
    return null;
  }
  return side === "left" ? clearUndoState.right : clearUndoState.left;
}

function triggerEditorCommand(
  editor: monaco.editor.IStandaloneCodeEditor,
  command: "undo" | "redo",
): void {
  const model = editor.getModel();
  if (model) {
    const modelWithUndo = model as monaco.editor.ITextModel & {
      undo?: () => void | Promise<void>;
      redo?: () => void | Promise<void>;
    };
    if (command === "undo" && typeof modelWithUndo.undo === "function") {
      void modelWithUndo.undo();
      return;
    }
    if (command === "redo" && typeof modelWithUndo.redo === "function") {
      void modelWithUndo.redo();
      return;
    }
  }
  editor.trigger?.("clear-sync", command, null);
}

function restoreClearUndoState(): void {
  if (!clearUndoState) {
    return;
  }
  if (clearUndoState.mode === "pane" && clearUndoState.targetSide) {
    const targetPane =
      clearUndoState.targetSide === "left"
        ? clearUndoState.left.pane
        : clearUndoState.right.pane;
    applyWorkspacePaneSnapshot(clearUndoState.targetSide, targetPane, {
      applyText: false,
    });
  } else {
    applyWorkspacePaneSnapshot("left", clearUndoState.left.pane, { applyText: false });
    applyWorkspacePaneSnapshot("right", clearUndoState.right.pane, { applyText: false });
  }
  setPaneSaveTargets("left", clearUndoState.left.saveTargets);
  setPaneSaveTargets("right", clearUndoState.right.saveTargets);
  restoreAnchorsFromSnapshot(clearUndoState.snapshot);
  clearUndoState.status = "restored";
}

function clearAfterRedoPane(side: "left" | "right"): void {
  const segments = getPaneSegments(side);
  const editor = getPaneEditor(side);
  segments.length = 0;
  clearPaneSourceState(side);
  updateLineNumbers(editor, segments);
  updateFileCards(side, []);
  setGoToLineSelection(side, null, { persist: false });
  if (side === "left") {
    resetPaneMessage(leftMessage);
    clearPaneSummary(storage, "left");
  } else {
    resetPaneMessage(rightMessage);
    clearPaneSummary(storage, "right");
  }
  resetAllAnchorsAndDecorations();
  recalcDiff();
  schedulePersistAll();
}

function clearAfterRedo(): void {
  if (!clearUndoState) {
    return;
  }
  if (clearUndoState.mode === "pane" && clearUndoState.targetSide) {
    clearAfterRedoPane(clearUndoState.targetSide);
    return;
  }
  leftSegments.length = 0;
  rightSegments.length = 0;
  clearPaneSourceState("left");
  clearPaneSourceState("right");
  updateLineNumbers(leftEditor, leftSegments);
  updateLineNumbers(rightEditor, rightSegments);
  updateFileCards("left", []);
  updateFileCards("right", []);
  setGoToLineSelection("left", null, { persist: false });
  setGoToLineSelection("right", null, { persist: false });
  resetAllAnchorsAndDecorations();
  recalcDiff();
  schedulePersistAll();
}

function handleClearUndoRedo(
  event: monaco.editor.IModelContentChangedEvent,
  side: "left" | "right",
  editor: monaco.editor.IStandaloneCodeEditor,
): boolean {
  if (!clearUndoState) {
    return false;
  }
  if (clearUndoState.mode === "pane" && clearUndoState.targetSide && side !== clearUndoState.targetSide) {
    return false;
  }
  const meta = clearUndoMetaForSide(side);
  if (!meta) {
    return false;
  }
  const otherMeta = clearUndoState.mode === "pane" ? null : clearUndoMetaForOther(side);
  const otherEditor = side === "left" ? rightEditor : leftEditor;
  const versionId = getEditorAlternativeVersionId(editor);
  if (event.isUndoing && clearUndoState.status === "armed") {
    if (meta.beforeVersionId === null || versionId === meta.beforeVersionId) {
      if (!suppressClearUndoSync && otherMeta) {
        suppressClearUndoSync = true;
        try {
          const otherVersion = getEditorAlternativeVersionId(otherEditor);
          if (
            otherMeta.beforeVersionId === null ||
            otherVersion !== otherMeta.beforeVersionId
          ) {
            triggerEditorCommand(otherEditor, "undo");
          }
        } finally {
          suppressClearUndoSync = false;
        }
      }
      restoreClearUndoState();
      return true;
    }
  }
  if (event.isRedoing && clearUndoState.status === "restored") {
    if (meta.afterVersionId === null || versionId === meta.afterVersionId) {
      if (!suppressClearUndoSync && otherMeta) {
        suppressClearUndoSync = true;
        try {
          const otherVersion = getEditorAlternativeVersionId(otherEditor);
          if (
            otherMeta.afterVersionId === null ||
            otherVersion !== otherMeta.afterVersionId
          ) {
            triggerEditorCommand(otherEditor, "redo");
          }
        } finally {
          suppressClearUndoSync = false;
        }
      }
      clearAfterRedo();
      clearUndoState.status = "armed";
      return true;
    }
  }
  return false;
}

function clearAnchorsForRedo() {
  resetAllAnchorsAndDecorations();
  recalcDiff();
  schedulePersistAll();
}

function bindAnchorUndoHandler(
  editor: monaco.editor.IStandaloneCodeEditor,
  side: "left" | "right",
) {
  const model = editor.getModel();
  if (!model) {
    return;
  }
  model.onDidChangeContent((event) => {
    if (handleClearUndoRedo(event, side, editor)) {
      return;
    }
    if (!anchorUndoState || anchorUndoState.editor !== side) {
      return;
    }
    const versionId = getEditorAlternativeVersionId(editor);
    if (event.isUndoing && anchorUndoState.status === "armed") {
      if (
        anchorUndoState.beforeVersionId === null ||
        versionId === anchorUndoState.beforeVersionId
      ) {
        restoreAnchorsFromSnapshot(anchorUndoState.snapshot);
        anchorUndoState.status = "restored";
      }
      return;
    }
    if (event.isRedoing && anchorUndoState.status === "restored") {
      if (
        anchorUndoState.afterVersionId === null ||
        versionId === anchorUndoState.afterVersionId
      ) {
        clearAnchorsForRedo();
        anchorUndoState.status = "armed";
      }
    }
  });
}

anchorList.addEventListener("keydown", (event) => {
  if (!selectedAnchorKey) {
    return;
  }
  const delta = resolveAnchorMoveDelta(event);
  if (delta === null) {
    return;
  }
  const nextKey = getNextAnchorKey(anchorEntryKeys, selectedAnchorKey, delta);
  if (!nextKey || nextKey === selectedAnchorKey) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  selectedAnchorKey = nextKey;
  renderAnchors(anchorValidationState.invalid, anchorValidationState.valid);
  jumpToAnchorEntry(nextKey);
  anchorList.focus();
  scheduleWorkspacePersist();
});

function setGoToLineOpen(side: "left" | "right", open: boolean): void {
  const pane = goToLinePanes[side];
  if (open) {
    pane.root.classList.add("is-open");
    pane.root.setAttribute("aria-hidden", "false");
  } else {
    pane.root.classList.remove("is-open");
    pane.root.setAttribute("aria-hidden", "true");
  }
}

function isGoToLineOpen(side: "left" | "right"): boolean {
  return goToLinePanes[side].root.classList.contains("is-open");
}

function updateGoToLineHint(side: "left" | "right", fileName: string | null): void {
  const pane = goToLinePanes[side];
  const segment = fileName ? getFileSegment(getPaneSegments(side), fileName) : null;
  if (!segment) {
    const editor = getPaneEditor(side);
    const lineCount = editor.getModel()?.getLineCount() ?? 1;
    pane.hint.textContent = `Type a line number to go to (from 1 to ${lineCount}).`;
    pane.input.setAttribute("min", "1");
    pane.input.setAttribute("max", String(lineCount));
    if (!pane.input.value.trim()) {
      pane.input.value = "1";
    }
    return;
  }
  pane.hint.textContent = `Type a line number to go to (from 1 to ${segment.lineCount}).`;
  pane.input.setAttribute("min", "1");
  pane.input.setAttribute("max", String(segment.lineCount));
  const current = Number.parseInt(pane.input.value.trim(), 10);
  if (Number.isFinite(current) && current > segment.lineCount) {
    pane.input.value = String(segment.lineCount);
  } else if (!pane.input.value.trim()) {
    pane.input.value = "1";
  }
}

function setGoToLineSelection(
  side: "left" | "right",
  fileName: string | null,
  options?: { persist?: boolean },
): void {
  goToLineSelection[side] = fileName;
  const pane = goToLinePanes[side];
  const buttons = Array.from(
    pane.files.querySelectorAll<HTMLButtonElement>("button.goto-line-file"),
  );
  for (const button of buttons) {
    const isSelected = button.dataset.file === fileName;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  }
  updateGoToLineHint(side, fileName);
  if (options?.persist !== false) {
    scheduleWorkspacePersist();
  }
}

function moveGoToLineSelection(side: "left" | "right", delta: number): void {
  const pane = goToLinePanes[side];
  const buttons = Array.from(
    pane.files.querySelectorAll<HTMLButtonElement>("button.goto-line-file"),
  );
  if (buttons.length === 0) {
    return;
  }
  const selectedIndex = Math.max(
    buttons.findIndex((button) => button.dataset.file === goToLineSelection[side]),
    0,
  );
  const nextIndex = moveSelectedIndex(selectedIndex, delta, buttons.length);
  const nextFile = buttons[nextIndex]?.dataset.file ?? null;
  setGoToLineSelection(side, nextFile);
  pane.input.focus();
}

function getOpenGoToLineSide(): "left" | "right" | null {
  if (isGoToLineOpen("left")) {
    return "left";
  }
  if (isGoToLineOpen("right")) {
    return "right";
  }
  return null;
}

function renderGoToLineFiles(
  side: "left" | "right",
  files: readonly string[],
  selected: string | null,
): void {
  const pane = goToLinePanes[side];
  pane.files.innerHTML = "";
  for (const fileName of files) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "goto-line-file";
    button.dataset.file = fileName;
    button.textContent = fileName;
    button.title = fileName;
    button.setAttribute("aria-pressed", String(fileName === selected));
    if (fileName === selected) {
      button.classList.add("is-selected");
    }
    pane.files.appendChild(button);
  }
}

function resolveDefaultGoToLine(
  side: "left" | "right",
  files: readonly string[],
): { fileName: string | null; localLine: number } {
  const editor = getPaneEditor(side);
  const segments = getPaneSegments(side);
  const position = editor.getPosition();
  const lineNumber = position?.lineNumber ?? 1;
  const info = getLineSegmentInfo(segments, lineNumber);
  const savedFile = goToLineSelection[side];
  const preferred =
    savedFile && files.includes(savedFile) ? savedFile : info?.fileName ?? files[0] ?? null;
  const localLine =
    preferred && preferred === info?.fileName ? info?.localLine ?? 1 : 1;
  const fileName = preferred;
  return { fileName, localLine };
}

function positionGoToLinePanel(side: "left" | "right"): void {
  const pane = goToLinePanes[side];
  const editorHost = side === "left" ? leftContainer : rightContainer;
  const paneHost = side === "left" ? leftPane : rightPane;
  const editorRect = editorHost.getBoundingClientRect();
  const paneRect = paneHost.getBoundingClientRect();
  const top = Math.max(8, editorRect.top - paneRect.top + 6);
  const left = Math.max(8, editorRect.left - paneRect.left + 10);
  pane.root.style.top = `${top}px`;
  pane.root.style.left = `${left}px`;
}

function openGoToLinePanel(side: "left" | "right"): void {
  const otherSide = side === "left" ? "right" : "left";
  setGoToLineOpen(otherSide, false);
  const pane = goToLinePanes[side];
  const segments = getPaneSegments(side);
  const files = listLoadedFileNames(segments);
  const { fileName, localLine } = resolveDefaultGoToLine(side, files);
  renderGoToLineFiles(side, files, fileName);
  setGoToLineSelection(side, fileName);
  pane.input.value = String(localLine);
  pane.input.disabled = false;
  positionGoToLinePanel(side);
  setGoToLineOpen(side, true);
  pane.input.focus();
  pane.input.select();
}

function closeGoToLinePanel(side: "left" | "right"): void {
  setGoToLineOpen(side, false);
}

function jumpToGlobalLine(
  editor: monaco.editor.IStandaloneCodeEditor,
  lineNumber: number,
): void {
  editor.setPosition({ lineNumber, column: 1 });
  if ("revealLineInCenter" in editor) {
    editor.revealLineInCenter(lineNumber);
  } else {
    editor.revealLine(lineNumber);
  }
  editor.focus();
}

function submitGoToLine(side: "left" | "right"): void {
  const pane = goToLinePanes[side];
  const fileName = goToLineSelection[side];
  const segments = getPaneSegments(side);
  const rawValue = pane.input.value.trim();
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) {
    return;
  }
  const editor = getPaneEditor(side);
  const model = editor.getModel();
  if (!model) {
    return;
  }
  if (!fileName) {
    const clamped = Math.min(Math.max(parsed, 1), model.getLineCount());
    jumpToGlobalLine(editor, clamped);
    closeGoToLinePanel(side);
    return;
  }
  const segment = getFileSegment(segments, fileName);
  if (!segment) {
    return;
  }
  const localLine = Math.min(Math.max(parsed, 1), segment.lineCount);
  const targetLine = getGlobalLineFromLocal(segments, fileName, localLine);
  if (!targetLine) {
    return;
  }
  const clamped = Math.min(Math.max(targetLine, 1), model.getLineCount());
  jumpToGlobalLine(editor, clamped);
  closeGoToLinePanel(side);
}

function jumpToFileStart(
  editor: monaco.editor.IStandaloneCodeEditor,
  segments: readonly LineSegment[],
  fileName: string,
): void {
  const startLine = getFileStartLine(segments, fileName);
  const model = editor.getModel();
  if (!startLine || !model) {
    return;
  }
  const line = Math.min(Math.max(startLine, 1), model.getLineCount());
  const anchorLine = Math.max(1, line - 1);
  editor.setPosition({ lineNumber: line, column: 1 });
  if ("getTopForLineNumber" in editor && "setScrollTop" in editor) {
    const top = editor.getTopForLineNumber(anchorLine);
    editor.setScrollTop(top);
  } else if ("revealLineAtTop" in editor) {
    editor.revealLineAtTop(anchorLine);
  } else {
    editor.revealLine(anchorLine);
  }
  editor.focus();
}


leftEditor.onDidFocusEditorText(() => {
  lastFocusedSide = "left";
});
rightEditor.onDidFocusEditorText(() => {
  lastFocusedSide = "right";
});

setupThemeToggle(document, {
  storage,
  onThemeChange: (mode) => {
    monaco.editor.setTheme(mode === "dark" ? "vs-dark" : "vs");
  },
});

leftEditor.onDidChangeModelContent((event) => {
  if (suppressLeftFileBytesClear) {
    return;
  }
  if (!areChangesWithinSingleFileSegments(leftSegments, event.changes)) {
    const snapshot = paneBoundarySnapshots.left;
    withProgrammaticEdit("left", () => {
      leftEditor.setValue(snapshot.text);
    });
    leftSegments.length = 0;
    leftSegments.push(...cloneSegmentsForSnapshot(snapshot.segments));
    updateLineNumbers(leftEditor, leftSegments);
    toast.show("ファイル境界をまたぐ編集はできません。", "error");
    scheduleRecalc();
    return;
  }
  updateSegmentsForChanges(leftSegments, event.changes);
  updateLineNumbers(leftEditor, leftSegments);
  commitPaneBoundarySnapshot("left");
  clearPaneRawFiles("left");
  schedulePersistAll();
  scheduleRecalc();
});
rightEditor.onDidChangeModelContent((event) => {
  if (suppressRightFileBytesClear) {
    return;
  }
  if (!areChangesWithinSingleFileSegments(rightSegments, event.changes)) {
    const snapshot = paneBoundarySnapshots.right;
    withProgrammaticEdit("right", () => {
      rightEditor.setValue(snapshot.text);
    });
    rightSegments.length = 0;
    rightSegments.push(...cloneSegmentsForSnapshot(snapshot.segments));
    updateLineNumbers(rightEditor, rightSegments);
    toast.show("ファイル境界をまたぐ編集はできません。", "error");
    scheduleRecalc();
    return;
  }
  updateSegmentsForChanges(rightSegments, event.changes);
  updateLineNumbers(rightEditor, rightSegments);
  commitPaneBoundarySnapshot("right");
  clearPaneRawFiles("right");
  schedulePersistAll();
  scheduleRecalc();
});

function updateLineNumbers(
  editor: monaco.editor.IStandaloneCodeEditor,
  segments: LineSegment[],
) {
  editor.updateOptions({
    lineNumbers: segments.length === 0 ? "on" : createLineNumberFormatter(segments),
  });
}

function applyDecodedFiles(
  side: "left" | "right",
  editor: monaco.editor.IStandaloneCodeEditor,
  segments: LineSegment[],
  rawFiles: FileBytes[],
  encoding: FileEncoding,
) {
  if (rawFiles.length === 0) {
    schedulePersist();
    return;
  }
  const { text, segments: nextSegments } = buildDecodedFiles(rawFiles, encoding);
  withProgrammaticEdit(side, () => {
    editor.setValue(text);
  });
  segments.length = 0;
  segments.push(...nextSegments);
  updateLineNumbers(editor, segments);
  applyIndentOptions(editor);
  commitPaneBoundarySnapshot(side);
  const fileNames = listLoadedFileNames(segments);
  updateFileCards(side, fileNames);
  if (!goToLineSelection[side] || !fileNames.includes(goToLineSelection[side] ?? "")) {
    setGoToLineSelection(side, fileNames[0] ?? null);
  }
  refreshSyntaxHighlight();
  recalcDiff();
  schedulePersistAll();
}

function applyEncodingSelection(
  select: HTMLSelectElement,
  value: FileEncoding | undefined,
) {
  if (!value) {
    return;
  }
  const option = Array.from(select.options).some((item) => item.value === value);
  if (option) {
    select.value = value;
  }
}

async function appendFilesToEditor(
  files: FileList | File[],
  encoding: FileEncoding,
  editor: monaco.editor.IStandaloneCodeEditor,
  messageTarget: HTMLDivElement,
  segments: LineSegment[],
  rawFiles: FileBytes[],
  side: "left" | "right",
): Promise<boolean> {
  const fileList = reorderRazorPairs(Array.from(files));
  if (fileList.length === 0) {
    showPaneMessage(messageTarget, "ファイルが見つかりませんでした", true);
    return false;
  }

  let currentFileName = "";
  const shouldTrackRawBytes = rawFiles.length > 0 || editor.getValue() === "";
  let nextSegments: LineSegment[] = [];
  let loadedNames: string[] = [];
  try {
    const incomingFiles: FileBytes[] = [];
    for (const file of fileList) {
      currentFileName = file.name;
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      incomingFiles.push({ name: file.name, bytes });
      if (shouldTrackRawBytes) {
        rawFiles.push({ name: file.name, bytes });
      }
    }

    const appended = appendDecodedFiles(editor.getValue(), segments, incomingFiles, encoding);
    nextSegments = appended.segments;
    withProgrammaticEdit(side, () => {
      editor.setValue(appended.text);
    });
    segments.length = 0;
    segments.push(...nextSegments);
    updateLineNumbers(editor, segments);
    commitPaneBoundarySnapshot(side);
    refreshSyntaxHighlight();
    const segmentNames = listLoadedFileNames(nextSegments);
    loadedNames =
      segmentNames.length > 0 ? segmentNames : fileList.map((file) => file.name);
  } catch (error) {
    if (shouldLogFileLoadError(error)) {
      console.error(error);
    } else {
      console.warn("File load failed without details.");
    }
    const detail = formatFileLoadError(error, currentFileName);
    showPaneMessage(messageTarget, detail, true);
    return false;
  }

  resetPaneMessage(messageTarget);
  clearPaneSummary(storage, side);
  updateFileCards(side, loadedNames);
  if (!goToLineSelection[side] || !loadedNames.includes(goToLineSelection[side] ?? "")) {
    setGoToLineSelection(side, loadedNames[0] ?? null);
  }
  runPostLoadTasks([recalcDiff, schedulePersist, scheduleWorkspacePersist]);
  return true;
}

function bindDropZone(
  zone: HTMLElement,
  editor: monaco.editor.IStandaloneCodeEditor,
  messageTarget: HTMLDivElement,
  encodingSelect: HTMLSelectElement,
  segments: LineSegment[],
  rawFiles: FileBytes[],
  side: "left" | "right",
) {
  zone.addEventListener("dragover", (event: DragEvent) => {
    if (
      event.dataTransfer?.types.includes("application/x-favorite-path") ||
      event.dataTransfer?.types.includes("application/x-workspace")
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    zone.classList.add("is-dragover");
  });

  zone.addEventListener("dragleave", (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && zone.contains(nextTarget)) {
      return;
    }
    zone.classList.remove("is-dragover");
  });

  zone.addEventListener("drop", (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    zone.classList.remove("is-dragover");

    if (
      event.dataTransfer?.types.includes("application/x-favorite-path") ||
      event.dataTransfer?.types.includes("application/x-workspace")
    ) {
      return;
    }
    const dataTransfer = event.dataTransfer;
    void (async () => {
      const dropped = await collectDroppedFiles(dataTransfer);
      if (dropped.length === 0) {
        showPaneMessage(messageTarget, "ファイルが見つかりませんでした", true);
        return;
      }

      const previousFileCount = getPaneFileCount(side);
      const previousTargets = clonePaneSaveTargets(paneSaveTargetLists[side]);
      const orderedDropped = pairFilesWithHandlesInDisplayOrder(
        dropped.map((item) => item.file),
        dropped.map((item) => item.handle),
      );
      const encoding = encodingSelect.value as FileEncoding;
      const loaded = await appendFilesToEditor(
        orderedDropped.map((item) => item.file),
        encoding,
        editor,
        messageTarget,
        segments,
        rawFiles,
        side,
      );
      if (!loaded) {
        return;
      }

      const writableDropped = orderedDropped.filter(
        (item): item is { file: File; handle: ReadableFileHandle } => item.handle !== null,
      );
      if (
        writableDropped.length === orderedDropped.length &&
        previousTargets.length === previousFileCount &&
        getPaneFileCount(side) === previousFileCount + orderedDropped.length
      ) {
        try {
          const nextTargets = await Promise.all(
            writableDropped.map((item) =>
              buildPaneSaveTarget(item.handle, item.file, encoding),
            ),
          );
          setPaneSaveTargets(side, previousTargets.concat(nextTargets));
        } catch (error) {
          if (shouldLogFileLoadError(error)) {
            console.error(error);
          } else {
            console.warn("Dropped file writeback metadata could not be prepared.");
          }
          clearPaneSaveTarget(side);
        }
        return;
      }

      clearPaneSaveTarget(side);
    })().catch((error) => {
      if (shouldLogFileLoadError(error)) {
        console.error(error);
      } else {
        console.warn("Dropped file load failed without details.");
      }
      showPaneMessage(messageTarget, formatFileLoadError(error), true);
    });
  });
}

const leftSegments: LineSegment[] = [];
const rightSegments: LineSegment[] = [];
const paneBindings = {
  left: {
    pane: leftPane,
    editor: leftEditor,
    message: leftMessage,
    encodingSelect: leftEncodingSelect,
    segments: leftSegments,
    rawFiles: leftFileBytes,
    fileCards: leftFileCards,
    fileInput: leftFileInput,
    fileButton: leftFileButton,
    saveButton: leftSaveFileButton,
    reloadButton: leftReloadFileButton,
  },
  right: {
    pane: rightPane,
    editor: rightEditor,
    message: rightMessage,
    encodingSelect: rightEncodingSelect,
    segments: rightSegments,
    rawFiles: rightFileBytes,
    fileCards: rightFileCards,
    fileInput: rightFileInput,
    fileButton: rightFileButton,
    saveButton: rightSaveFileButton,
    reloadButton: rightReloadFileButton,
  },
} as const;
const paneEntries = Object.entries(paneBindings) as [
  "left" | "right",
  (typeof paneBindings)["left"],
][];
const paneSides = paneEntries.map(([side]) => side);
const hasFileSystemAccess = supportsFileSystemAccess(window as FileSystemAccessWindow);
const paneSaveTargetStore = createIndexedDbPaneSaveTargetStore();

function getPaneFileCount(side: "left" | "right"): number {
  return listLoadedFileNames(paneBindings[side].segments).length;
}

function getPaneWriteAvailabilityForTargets(side: "left" | "right"): {
  enabled: boolean;
  reason: string | null;
} {
  const fileCount = getPaneFileCount(side);
  const targets = paneSaveTargetLists[side];
  if (fileCount <= 1) {
    return getPaneWriteAvailability({
      hasFileSystemAccess,
      fileCount,
      selectedEncoding: paneBindings[side].encodingSelect.value as FileEncoding,
      target: paneSaveTargets[side],
    });
  }
  if (!hasFileSystemAccess) {
    return {
      enabled: false,
      reason: "このブラウザでは上書き保存に対応していません。",
    };
  }
  if (targets.length !== fileCount) {
    return {
      enabled: false,
      reason: "全ファイルの保存用ハンドルがある場合だけ保存できます。",
    };
  }
  if (!targets.every((target) => isReadableWritableFileHandle(target.handle))) {
    return {
      enabled: false,
      reason: "全ファイルの保存用ハンドルがある場合だけ保存できます。",
    };
  }
  const selectedEncoding = paneBindings[side].encodingSelect.value as FileEncoding;
  if (
    selectedEncoding !== "auto" &&
    targets.some((target) => target.resolvedEncoding !== selectedEncoding)
  ) {
    return {
      enabled: false,
      reason: "元の文字コード表示中のときだけ保存できます。",
    };
  }
  return {
    enabled: true,
    reason: null,
  };
}

function updatePaneSaveButton(side: "left" | "right"): void {
  const button = paneBindings[side].saveButton;
  button.textContent = "保存";
  if (!writebackEnabled) {
    button.disabled = true;
    button.title = "保存機能はこの画面では無効です。";
    button.removeAttribute("aria-busy");
    return;
  }
  if (paneSavePending[side]) {
    button.disabled = true;
    button.title = "保存中です。";
    button.setAttribute("aria-busy", "true");
    return;
  }

  const targets = paneSaveTargetLists[side];
  const availability = getPaneWriteAvailabilityForTargets(side);
  button.disabled = !availability.enabled;
  button.removeAttribute("aria-busy");
  if (availability.enabled && targets.length > 0) {
    button.title =
      targets.length === 1
        ? `${targets[0].fileName} を保存`
        : `${targets.length}ファイルを保存`;
    return;
  }
  button.title = availability.reason ?? "";
}

function updatePaneReloadButton(side: "left" | "right"): void {
  const button = paneBindings[side].reloadButton;
  button.textContent = "再読み込み";
  if (paneReloadPending[side]) {
    button.disabled = true;
    button.title = "再読み込み中です。";
    button.setAttribute("aria-busy", "true");
    return;
  }
  const fileCount = getPaneFileCount(side);
  const targets = paneSaveTargetLists[side];
  if (fileCount === 0) {
    button.disabled = true;
    button.removeAttribute("aria-busy");
    button.title = "再読み込みできるファイルがありません。";
    return;
  }
  if (targets.length !== fileCount || targets.some((target) => !target.handle)) {
    button.disabled = true;
    button.removeAttribute("aria-busy");
    button.title = "ファイル選択ボタンから開いたファイルだけ再読み込みできます。";
    return;
  }
  button.disabled = false;
  button.removeAttribute("aria-busy");
  button.title =
    targets.length === 1
      ? `${targets[0].fileName} を再読み込み`
      : `${targets.length}ファイルを再読み込み`;
}

function persistPaneSaveTarget(side: "left" | "right"): void {
  if (!paneSaveTargetStore.isAvailable) {
    return;
  }
  const targets = paneSaveTargetLists[side];
  const task = targets.length > 0
    ? savePaneSaveTargets(paneSaveTargetStore, workspaceState.selectedId, side, targets)
    : clearStoredPaneSaveTarget(paneSaveTargetStore, workspaceState.selectedId, side);
  task.catch((error) => {
    console.warn("Failed to persist pane save target:", error);
  });
}

function setPaneSaveTargets(
  side: "left" | "right",
  targets: readonly PaneSaveTarget[],
  options?: { persist?: boolean },
): void {
  paneSaveTargetLists[side] = clonePaneSaveTargets(targets);
  paneSaveTargets[side] =
    paneSaveTargetLists[side].length === 1
      ? clonePaneSaveTarget(paneSaveTargetLists[side][0])
      : null;
  updatePaneSaveButton(side);
  updatePaneReloadButton(side);
  if (options?.persist !== false) {
    persistPaneSaveTarget(side);
  }
}

function clearPaneSaveTarget(
  side: "left" | "right",
  options?: { persist?: boolean },
): void {
  setPaneSaveTargets(side, [], options);
}

function clearPaneRawFiles(side: "left" | "right"): void {
  paneBindings[side].rawFiles.length = 0;
}

function clearPaneSourceState(
  side: "left" | "right",
  options?: { persistSaveTarget?: boolean },
): void {
  clearPaneRawFiles(side);
  clearPaneSaveTarget(side, { persist: options?.persistSaveTarget });
  commitPaneBoundarySnapshot(side);
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

async function buildPaneSaveTarget(
  handle: ReadableFileHandle,
  file: File,
  encoding: FileEncoding,
): Promise<PaneSaveTarget> {
  const metadata = describeDecodedFileForWriteback(await file.arrayBuffer(), encoding);
  return {
    handle,
    fileName: file.name,
    resolvedEncoding: metadata.resolvedEncoding,
    includeUtf8Bom: metadata.includeUtf8Bom,
    lineEnding: metadata.lineEnding,
  };
}

async function openPaneFiles(side: "left" | "right"): Promise<void> {
  const config = paneBindings[side];
  if (!hasFileSystemAccess) {
    config.fileInput.click();
    return;
  }

  try {
    const picked = await pickFilesWithHandles(window as FileSystemAccessWindow, {
      multiple: true,
    });
    if (picked.files.length === 0) {
      return;
    }

    const encoding = config.encodingSelect.value as FileEncoding;
    const previousFileCount = getPaneFileCount(side);
    const previousTargets = clonePaneSaveTargets(paneSaveTargetLists[side]);
    const pickedItems = pairFilesWithHandlesInDisplayOrder(
      picked.files,
      picked.handles,
    );
    const loaded = await appendFilesToEditor(
      pickedItems.map((item) => item.file),
      encoding,
      config.editor,
      config.message,
      config.segments,
      config.rawFiles,
      side,
    );
    if (!loaded) {
      return;
    }

    if (
      previousTargets.length === previousFileCount &&
      getPaneFileCount(side) === previousFileCount + pickedItems.length
    ) {
      try {
        const nextTargets = await Promise.all(
          pickedItems.map((item) =>
            buildPaneSaveTarget(item.handle, item.file, encoding),
          ),
        );
        setPaneSaveTargets(side, previousTargets.concat(nextTargets));
      } catch (error) {
        if (shouldLogFileLoadError(error)) {
          console.error(error);
        } else {
          console.warn("File writeback metadata could not be prepared.");
        }
        clearPaneSaveTarget(side);
      }
      return;
    }

    clearPaneSaveTarget(side);
  } catch (error) {
    if (isAbortError(error)) {
      return;
    }
    if (shouldLogFileLoadError(error)) {
      console.error(error);
    } else {
      console.warn("File picker failed without details.");
    }
    toast.show("ファイルを開けませんでした", "error");
  }
}

async function savePaneToFile(side: "left" | "right"): Promise<void> {
  if (!writebackEnabled) {
    toast.show("保存機能はこの画面では無効です。", "error");
    updatePaneSaveButton(side);
    return;
  }
  if (paneSavePending[side]) {
    return;
  }
  const targets = paneSaveTargetLists[side];
  const availability = getPaneWriteAvailabilityForTargets(side);
  if (!availability.enabled || targets.length === 0) {
    toast.show(availability.reason ?? "保存できませんでした。", "error");
    updatePaneSaveButton(side);
    return;
  }

  paneSavePending[side] = true;
  updatePaneSaveButton(side);
  try {
    const writableTargets = targets.filter(hasWritablePaneHandle);
    if (writableTargets.length !== targets.length) {
      toast.show("保存用の権限がないファイルがあります。", "error");
      return;
    }
    const writeItems = buildMultiFileWritePlan(
      paneBindings[side].editor.getValue(),
      paneBindings[side].segments,
      writableTargets,
    );
    for (const { target } of writeItems) {
      const permitted = await requestFileHandlePermission(target.handle, "readwrite");
      if (!permitted) {
        toast.show(`${target.fileName} の保存権限がありません。`, "error");
        return;
      }
    }
    for (const { target, bytes } of writeItems) {
      await writeBytesToFileHandle(target.handle, bytes);
    }
    toast.show(
      targets.length === 1
        ? `${targets[0].fileName} を保存しました。`
        : `${targets.length}ファイルを保存しました。`,
    );
  } catch (error) {
    if (isAbortError(error)) {
      return;
    }
    console.error(error);
    toast.show("ファイルを保存できませんでした。", "error");
  } finally {
    paneSavePending[side] = false;
    updatePaneSaveButton(side);
  }
}

async function reloadPaneFromFile(side: "left" | "right"): Promise<void> {
  if (paneReloadPending[side]) {
    return;
  }
  const targets = paneSaveTargetLists[side];
  if (targets.length === 0 || targets.length !== getPaneFileCount(side)) {
    toast.show("再読み込みできるファイルがありません。", "error");
    updatePaneReloadButton(side);
    return;
  }

  paneReloadPending[side] = true;
  updatePaneReloadButton(side);
  try {
    for (const target of targets) {
      const permitted = await requestFileHandlePermission(target.handle, "read");
      if (!permitted) {
        toast.show(`${target.fileName} の読み込み権限がありません。`, "error");
        return;
      }
    }
    const config = paneBindings[side];
    const selectedEncoding = config.encodingSelect.value as FileEncoding;
    const reloaded = await Promise.all(
      targets.map((target) =>
        readCurrentFileFromPaneTarget(
          target,
          resolveReloadEncodingForPaneTarget({
            fileCount: targets.length,
            selectedEncoding,
            target,
          }),
        ),
      ),
    );
    const nextRawFiles: FileBytes[] = reloaded.map((item) => ({
      name: item.file.name,
      bytes: item.bytes,
      encoding: item.target.resolvedEncoding,
    }));
    const decoded = buildDecodedFiles(nextRawFiles, selectedEncoding, {
      preferFileEncoding: true,
    });

    withProgrammaticEdit(side, () => {
      config.editor.setValue(decoded.text);
    });
    config.rawFiles.length = 0;
    config.rawFiles.push(...nextRawFiles);
    config.segments.length = 0;
    config.segments.push(...decoded.segments);
    updateLineNumbers(config.editor, config.segments);
    applyIndentOptions(config.editor);
    commitPaneBoundarySnapshot(side);
    const fileNames = listLoadedFileNames(config.segments);
    updateFileCards(side, fileNames);
    if (!goToLineSelection[side] || !fileNames.includes(goToLineSelection[side] ?? "")) {
      setGoToLineSelection(side, fileNames[0] ?? null);
    }
    resetPaneMessage(config.message);
    clearPaneSummary(storage, side);
    setPaneSaveTargets(side, reloaded.map((item) => item.target));
    refreshSyntaxHighlight();
    recalcDiff();
    schedulePersistAll();
    toast.show(
      reloaded.length === 1
        ? `${reloaded[0].file.name} を再読み込みしました。`
        : `${reloaded.length}ファイルを再読み込みしました。`,
    );
  } catch (error) {
    if (isAbortError(error)) {
      return;
    }
    console.error(error);
    toast.show("ファイルを再読み込みできませんでした。", "error");
  } finally {
    paneReloadPending[side] = false;
    updatePaneReloadButton(side);
  }
}

async function restorePaneSaveTargetForWorkspace(
  side: "left" | "right",
  workspaceId: string,
): Promise<void> {
  if (!paneSaveTargetStore.isAvailable) {
    return;
  }
  try {
    const targets = await loadPaneSaveTargets(paneSaveTargetStore, workspaceId, side);
    if (workspaceState.selectedId !== workspaceId) {
      return;
    }
    if (targets.length === 0) {
      updatePaneReloadButton(side);
      return;
    }
    const fileNames = listLoadedFileNames(paneBindings[side].segments);
    if (
      fileNames.length !== targets.length ||
      fileNames.some((fileName, index) => fileName !== targets[index]?.fileName)
    ) {
      await clearStoredPaneSaveTarget(paneSaveTargetStore, workspaceId, side);
      clearPaneSaveTarget(side, { persist: false });
      return;
    }
    setPaneSaveTargets(side, targets, { persist: false });
  } catch (error) {
    console.warn("Failed to restore pane save target:", error);
    clearPaneSaveTarget(side, { persist: false });
  }
}

async function restorePaneSaveTargetsForWorkspace(workspaceId: string): Promise<void> {
  await Promise.all(
    paneSides.map((side) => restorePaneSaveTargetForWorkspace(side, workspaceId)),
  );
}

const initialWorkspace = getSelectedWorkspace(workspaceState);
if (initialWorkspace) {
  paneSides.forEach((side) => {
    applyWorkspacePaneSnapshot(side, getWorkspacePaneSnapshot(initialWorkspace, side), {
      applyText: false,
    });
  });
  void restorePaneSaveTargetsForWorkspace(workspaceState.selectedId);
}
refreshSyntaxHighlight();
paneSides.forEach((side) => renderFavoriteList(side));
renderWorkspacePanel();

const workspaceController = createWorkspacePanelController({
  panel: workspacePanel,
  overlay: workspaceOverlay,
  toggleButton: workspaceToggle,
  onReset: () => {
    editingWorkspaceId = null;
    focusedWorkspaceId = null;
    renderWorkspacePanel();
  },
});
requestWorkspaceToggle = () => workspaceController.toggle();
if (pendingWorkspaceToggle) {
  pendingWorkspaceToggle = false;
  requestWorkspaceToggle();
}

function createFavoriteController(
  side: "left" | "right",
  elements: {
    panel: HTMLElement;
    overlay: HTMLElement;
    addButton: HTMLButtonElement;
    cancelButton: HTMLButtonElement;
    input: HTMLInputElement;
    error: HTMLDivElement;
  },
) {
  return createFavoritePanelController({
    panel: elements.panel,
    overlay: elements.overlay,
    addButton: elements.addButton,
    cancelButton: elements.cancelButton,
    input: elements.input,
    onReset: () => {
      setFavoriteError(elements.error, "");
      setFavoriteFocus(side, null);
    },
  });
}

const leftFavoriteController = createFavoriteController("left", {
  panel: leftFavoritePanel,
  overlay: leftFavoriteOverlay,
  addButton: leftFavoriteAdd,
  cancelButton: leftFavoriteCancel,
  input: leftFavoriteInput,
  error: leftFavoriteError,
});
const rightFavoriteController = createFavoriteController("right", {
  panel: rightFavoritePanel,
  overlay: rightFavoriteOverlay,
  addButton: rightFavoriteAdd,
  cancelButton: rightFavoriteCancel,
  input: rightFavoriteInput,
  error: rightFavoriteError,
});
const favoriteControllers = {
  left: leftFavoriteController,
  right: rightFavoriteController,
} as const;
const favoriteAddButtons = {
  left: leftFavoriteAdd,
  right: rightFavoriteAdd,
} as const;

function bindFavoriteToggleButton(
  toggleButton: HTMLButtonElement,
  controller: FavoritePanelController,
  otherController: FavoritePanelController,
) {
  toggleButton.addEventListener("click", () => {
    if (otherController.isOpen()) {
      otherController.close();
    }
    controller.toggle();
  });
}

paneSides.forEach((side) => {
  const otherSide = side === "left" ? "right" : "left";
  bindFavoriteToggleButton(
    favoriteAddButtons[side],
    favoriteControllers[side],
    favoriteControllers[otherSide],
  );
});

workspaceCreate.addEventListener("click", () => {
  persistCurrentWorkspaceState();
  const result = createWorkspace(storage, workspaceState, "Workspace", { textStore });
  if (!result.ok) {
    if (result.reason === "limit") {
      toast.show("最大10件です", "error");
    } else if (result.reason === "length") {
      toast.show(`名前は${WORKSPACE_NAME_LIMIT}文字以内です`, "error");
    } else {
      toast.show("ワークスペースを追加できませんでした", "error");
    }
    return;
  }
  editingWorkspaceId = result.state.selectedId;
  applyWorkspaceState(result.state, { focusInput: true });
});

workspaceList.addEventListener("click", (event) => {
  const action = getWorkspaceAction(event.target as HTMLElement);
  if (!action) {
    return;
  }
  if (action.type === "select") {
    editingWorkspaceId = null;
    if (action.id === workspaceState.selectedId) {
      setWorkspaceFocus(action.id, { focusItem: true });
      workspaceController.close();
      return;
    }
    switchWorkspaceById(action.id, { focusItem: true });
    workspaceController.close();
    return;
  }
  if (action.type === "rename") {
    editingWorkspaceId = action.id;
    focusedWorkspaceId = action.id;
    renderWorkspacePanel({ focusInput: true });
    return;
  }
  if (action.type === "remove") {
    persistCurrentWorkspaceState();
    const result = removeWorkspaceWithConfirm(
      storage,
      workspaceState,
      action.id,
      window.confirm,
      { textStore },
    );
    if (!result.ok) {
      if (result.reason === "last") {
        toast.show("最後の1件は削除できません", "error");
      }
      return;
    }
    editingWorkspaceId = null;
    applyWorkspaceState(result.state);
  }
});

workspaceList.addEventListener("keydown", (event) => {
  const input = (event.target as HTMLElement).closest<HTMLInputElement>(
    ".workspace-item__input",
  );
  if (!input) {
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    const item = input.closest<HTMLElement>(".workspace-item");
    const id = item?.dataset.id;
    if (id) {
      handleWorkspaceRename(id, input.value);
    }
  } else if (event.key === "Escape") {
    event.preventDefault();
    editingWorkspaceId = null;
    renderWorkspacePanel();
  }
});

workspaceList.addEventListener("focusin", (event) => {
  const item = (event.target as HTMLElement).closest<HTMLElement>(".workspace-item");
  if (!item) {
    return;
  }
  setWorkspaceFocus(item.dataset.id ?? null);
});

workspaceList.addEventListener("focusout", (event) => {
  const input = (event.target as HTMLElement).closest<HTMLInputElement>(
    ".workspace-item__input",
  );
  if (!input) {
    return;
  }
  const item = input.closest<HTMLElement>(".workspace-item");
  const id = item?.dataset.id;
  if (!id) {
    return;
  }
  handleWorkspaceRename(id, input.value);
});

workspaceList.addEventListener("focusout", (event) => {
  const nextTarget = event.relatedTarget as HTMLElement | null;
  if (nextTarget && workspaceList.contains(nextTarget)) {
    return;
  }
  setWorkspaceFocus(null);
});

bindWorkspaceDragHandlers(workspaceList, (move) => {
  const result = reorderWorkspaces(
    storage,
    workspaceState,
    move.from,
    move.to,
    { textStore },
  );
  if (!result.ok) {
    return;
  }
  workspaceState = result.state;
  renderWorkspacePanel();
});

paneEntries.forEach(([side, config]) => {
  bindDropZone(
    config.pane,
    config.editor,
    config.message,
    config.encodingSelect,
    config.segments,
    config.rawFiles,
    side,
  );
  bindFileCardJump(config.fileCards, (fileName) => {
    jumpToFileStart(config.editor, config.segments, fileName);
  });
});

const favoriteBindings = {
  left: {
    input: leftFavoriteInput,
    saveButton: leftFavoriteSave,
    error: leftFavoriteError,
    list: leftFavoritePaths,
  },
  right: {
    input: rightFavoriteInput,
    saveButton: rightFavoriteSave,
    error: rightFavoriteError,
    list: rightFavoritePaths,
  },
} as const;
paneSides.forEach((side) => {
  bindFavoritePane(side, favoriteBindings[side]);
});

function bindGoToLinePanel(side: "left" | "right") {
  const pane = goToLinePanes[side];
  const closeButton = pane.root.querySelector<HTMLButtonElement>(".goto-line-close");
  if (closeButton) {
    closeButton.addEventListener("click", () => closeGoToLinePanel(side));
  }

  const stopPanelKey = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      closeGoToLinePanel(side);
    }
  };
  pane.root.addEventListener("keydown", stopPanelKey);
  pane.root.addEventListener("keypress", stopPanelKey);
  pane.root.addEventListener("keyup", stopPanelKey);

  pane.files.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button.goto-line-file",
    );
    if (!target) {
      return;
    }
    setGoToLineSelection(side, target.dataset.file ?? null);
    pane.input.focus();
  });

  pane.input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      submitGoToLine(side);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeGoToLinePanel(side);
    }
  });
}

paneSides.forEach((side) => {
  bindGoToLinePanel(side);
});

function bindFilePicker(
  input: HTMLInputElement,
  editor: monaco.editor.IStandaloneCodeEditor,
  messageTarget: HTMLDivElement,
  encodingSelect: HTMLSelectElement,
  segments: LineSegment[],
  rawFiles: FileBytes[],
  side: "left" | "right",
) {
  input.addEventListener("change", () => {
    const files = input.files;
    if (!files || files.length === 0) {
      return;
    }
    const encoding = encodingSelect.value as FileEncoding;
    void appendFilesToEditor(files, encoding, editor, messageTarget, segments, rawFiles, side)
      .then((loaded) => {
        if (!loaded) {
          return;
        }
        clearPaneSaveTarget(side);
      });
    input.value = "";
  });
}

paneEntries.forEach(([side, config]) => {
  bindFilePicker(
    config.fileInput,
    config.editor,
    config.message,
    config.encodingSelect,
    config.segments,
    config.rawFiles,
    side,
  );
  config.fileButton.addEventListener("click", () => {
    void openPaneFiles(side);
  });
  config.saveButton.addEventListener("click", () => {
    void savePaneToFile(side);
  });
  config.reloadButton.addEventListener("click", () => {
    void reloadPaneFromFile(side);
  });
  updatePaneSaveButton(side);
  updatePaneReloadButton(side);
});

paneEntries.forEach(([side, config]) => {
  config.encodingSelect.addEventListener("change", () => {
    const encoding = config.encodingSelect.value as FileEncoding;
    applyDecodedFiles(side, config.editor, config.segments, config.rawFiles, encoding);
    updatePaneSaveButton(side);
    updatePaneReloadButton(side);
  });
});

function getPersistedStateSnapshot(): PersistedState {
  const anchorPanel = document.querySelector(".anchor-panel");
  return {
    version: 1,
    leftText: leftEditor.getValue(),
    rightText: rightEditor.getValue(),
    leftEncoding: leftEncodingSelect.value as FileEncoding,
    rightEncoding: rightEncodingSelect.value as FileEncoding,
    scrollSync: syncToggle?.checked ?? true,
    foldEnabled,
    anchorPanelCollapsed: anchorPanel?.classList.contains("is-collapsed") ?? false,
    anchors: manualAnchors.map((anchor) => ({ ...anchor })),
    leftSegments: leftSegments.map((segment) => ({ ...segment })),
    rightSegments: rightSegments.map((segment) => ({ ...segment })),
  };
}

persistScheduler = createPersistScheduler({
  storage,
  getState: getPersistedStateSnapshot,
  textStore,
});

function flushStateForLifecycle(): void {
  cancelWorkspacePersist();
  persistWorkspacePaneState("left");
  persistWorkspacePaneState("right");
  const anchorResult = setWorkspaceAnchors(
    storage,
    workspaceState,
    workspaceState.selectedId,
    getCurrentAnchorState(),
    { textStore },
  );
  if (anchorResult.ok) {
    workspaceState = anchorResult.state;
  }
  persistScheduler?.flush();
  saveInlinePersistedStateSnapshot(storage, getPersistedStateSnapshot());
}

function preventWindowDrop(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
}

window.addEventListener("dragover", preventWindowDrop);
window.addEventListener("drop", preventWindowDrop);
window.addEventListener("pagehide", () => {
  flushStateForLifecycle();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flushStateForLifecycle();
  }
});
window.addEventListener(
  "keydown",
  (event) => {
    const openSide = getOpenGoToLineSide();
    if (openSide) {
      const moveHandled = handleGoToLineFileMoveShortcut(event, {
        isOpen: true,
        move: (delta) => moveGoToLineSelection(openSide, delta),
      });
      if (moveHandled) {
        return;
      }
    } else {
      const anchorHandled = handleAnchorShortcut(event, {
        left: leftEditor,
        right: rightEditor,
        onLeft: handleLeftAnchorAction,
        onRight: handleRightAnchorAction,
      });
      if (anchorHandled) {
        return;
      }
      const focusHandled = handlePaneFocusShortcut(event, {
        leftEditor,
        rightEditor,
      });
      if (focusHandled) {
        return;
      }
    }

    if (workspaceController.isOpen()) {
      const isEditing =
        document.activeElement?.classList.contains("workspace-item__input") ??
        false;
      if (!isEditing) {
        const navigationHandled = handleWorkspaceNavigation(event, {
          workspaces: workspaceState.workspaces,
          selectedId: workspaceState.selectedId,
          onMove: (id) => {
            setWorkspaceFocus(id, { focusItem: true });
          },
          onSelect: (id) => {
            switchWorkspaceById(id, { focusItem: true });
          },
        });
        if (navigationHandled) {
          return;
        }
        if (event.key === "Enter") {
          const targetId = focusedWorkspaceId ?? workspaceState.selectedId;
          if (targetId) {
            if (targetId === workspaceState.selectedId) {
              setWorkspaceFocus(targetId, { focusItem: true });
            } else {
              switchWorkspaceById(targetId, { focusItem: true });
            }
            workspaceController.close();
          }
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (event.key === "Tab") {
          event.preventDefault();
          event.stopPropagation();
          if (focusedWorkspaceId) {
            setWorkspaceFocus(focusedWorkspaceId, { focusItem: true });
          }
          return;
        }
      }
    }

    const favoriteHandled = handleFavoritePanelShortcut(event, {
      left: leftFavoriteController,
      right: rightFavoriteController,
      getLastFocused: () => lastFocusedSide,
    });
    if (favoriteHandled) {
      event.stopPropagation();
      return;
    }

    const fileOpenHandled = handleFileOpenShortcut(event, {
      openLeft: () => {
        void openPaneFiles("left");
      },
      openRight: () => {
        void openPaneFiles("right");
      },
      getLastFocused: () => lastFocusedSide,
    });
    if (fileOpenHandled) {
      event.stopPropagation();
      return;
    }

    const clearHandled = handlePaneClearShortcut(event, {
      clearFocused: clearFocusedPane,
      clearAll: clearAllPanes,
    });
    if (clearHandled) {
      event.stopPropagation();
      return;
    }

    const themeHandled = handleThemeShortcut(event, {
      toggle: toggleTheme,
    });
    if (themeHandled) {
      event.stopPropagation();
      return;
    }

    const highlightHandled = handleHighlightShortcut(event, {
      toggle: toggleHighlight,
    });
    if (highlightHandled) {
      event.stopPropagation();
      return;
    }

    const favoriteOpenSide = getOpenFavoriteSide();
    if (favoriteOpenSide) {
      const paths = getFavoritePaths(favoriteOpenSide);
      const input =
        favoriteOpenSide === "left" ? leftFavoriteInput : rightFavoriteInput;
      const inputHasFocus = document.activeElement === input;
      if (
        !(
          inputHasFocus &&
          (event.key === "Enter" || event.key === "Delete")
        )
      ) {
        const listHandled = handleFavoriteListKeydown(event, {
          length: paths.length,
          currentIndex: favoriteFocusIndex[favoriteOpenSide],
          onMove: (nextIndex) => {
            setFavoriteFocus(favoriteOpenSide, nextIndex, { focusItem: true });
          },
          onCopy: async (index) => {
            const path = paths[index] ?? "";
            if (!path) {
              toast.show("コピー対象がありません", "error");
              return;
            }
            await copyFavoritePath({
              path,
              doc: document,
              copy: copyText,
              toast,
              onSuccess: () => closeFavoritePanel(favoriteOpenSide),
            });
          },
          onRemove: (index) => {
            const current = getFavoritePaths(favoriteOpenSide);
            const next = removeFavoritePath(
              storage,
              favoriteOpenSide,
              workspaceState.selectedId,
              current,
              index,
            );
            if (next === current) {
              return;
            }
            setFavoritePaths(favoriteOpenSide, next);
            favoriteFocusIndex[favoriteOpenSide] =
              adjustFavoriteFocusAfterRemove(
                favoriteFocusIndex[favoriteOpenSide],
                index,
                next.length,
              );
            renderFavoriteList(favoriteOpenSide, { focusItem: true });
          },
        });
        if (listHandled) {
          return;
        }
      }
      const focused = focusFavoriteInputOnKey(event, input);
      if (focused) {
        return;
      }
    }

    const findHandled = handleFindShortcut(event, {
      left: leftEditor,
      right: rightEditor,
      getLastFocused: () => lastFocusedSide,
    });
    const goToHandled = handleGoToLineShortcut(event, {
      left: leftEditor,
      right: rightEditor,
      getLastFocused: () => lastFocusedSide,
      open: openGoToLinePanel,
      close: closeGoToLinePanel,
      isOpen: isGoToLineOpen,
    });
    if (findHandled) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scheduleRecalc();
        });
      });
    }
    if (findHandled || goToHandled) {
      event.stopPropagation();
    }
  },
  { capture: true },
);

const scrollSync = new ScrollSyncController(
  {
    onDidScrollChange: (handler) => {
      leftEditor.onDidScrollChange((event) =>
        handler({ scrollTop: event.scrollTop, scrollLeft: event.scrollLeft }),
      );
    },
    setScrollTop: (value) => leftEditor.setScrollTop(value),
    setScrollLeft: (value) => leftEditor.setScrollLeft(value),
  },
  {
    onDidScrollChange: (handler) => {
      rightEditor.onDidScrollChange((event) =>
        handler({ scrollTop: event.scrollTop, scrollLeft: event.scrollLeft }),
      );
    },
    setScrollTop: (value) => rightEditor.setScrollTop(value),
    setScrollLeft: (value) => rightEditor.setScrollLeft(value),
  },
);

let leftDecorationIds: string[] = [];
let rightDecorationIds: string[] = [];
let leftZoneIds: string[] = [];
let rightZoneIds: string[] = [];
let leftDecorationSignatures: string[] = [];
let rightDecorationSignatures: string[] = [];
let leftAnchorDecorationSignatures: string[] = [];
let rightAnchorDecorationSignatures: string[] = [];
let leftZoneSignatures: string[] = [];
let rightZoneSignatures: string[] = [];
let pairedOps: PairedOp[] = [];
let diffBlockStarts: number[] = [];
let currentBlockIndex = 0;
let leftFocusDecorationIds: string[] = [];
let rightFocusDecorationIds: string[] = [];
let foldEnabled = persistedState?.foldEnabled ?? false;
let ignoreLeadingFileWhitespace = false;
let foldRanges: FoldRange[] = [];
let leftFoldZoneIds: string[] = [];
let rightFoldZoneIds: string[] = [];
const expandedFoldStarts = new Set<number>();
let initialWorkspaceAnchors = startupRestore.initialAnchors;

if (startupRestore.shouldPersistAnchors) {
  const selected = getSelectedWorkspace(workspaceState);
  if (selected) {
    const migrated = setWorkspaceAnchors(
      storage,
      workspaceState,
      selected.id,
      startupRestore.initialAnchors,
      { textStore },
    );
    if (migrated.ok) {
      workspaceState = migrated.state;
      initialWorkspaceAnchors =
        getSelectedWorkspace(workspaceState)?.anchors ?? emptyWorkspaceAnchors;
    }
  }
}

initialWorkspaceAnchors = cloneWorkspaceAnchors(initialWorkspaceAnchors);

let manualAnchors: Anchor[] = initialWorkspaceAnchors.manualAnchors;
let autoAnchor: Anchor | null = initialWorkspaceAnchors.autoAnchor;
let suppressedAutoAnchorKey: string | null =
  initialWorkspaceAnchors.suppressedAutoAnchorKey;
let pendingLeftLineNo: number | null = initialWorkspaceAnchors.pendingLeftLineNo;
let pendingRightLineNo: number | null = initialWorkspaceAnchors.pendingRightLineNo;
let leftAnchorDecorationIds: string[] = [];
let rightAnchorDecorationIds: string[] = [];
let selectedAnchorKey: string | null = initialWorkspaceAnchors.selectedAnchorKey;
let pendingLeftDecorationIds: string[] = [];
let pendingRightDecorationIds: string[] = [];
let anchorEntryKeys: string[] = [];
const anchorEntryMap = new Map<string, { anchor: Anchor; canJump: boolean }>();
let anchorValidationState: {
  invalid: { anchor: Anchor; reasons: string[] }[];
  valid: Anchor[];
} = { invalid: [], valid: [] };
type AnchorSnapshot = {
  manualAnchors: Anchor[];
  suppressedAutoAnchorKey: string | null;
  pendingLeftLineNo: number | null;
  pendingRightLineNo: number | null;
  selectedAnchorKey: string | null;
};

type AnchorUndoState = {
  snapshot: AnchorSnapshot;
  editor: "left" | "right";
  beforeVersionId: number | null;
  afterVersionId: number | null;
  status: "armed" | "restored";
};

let anchorUndoState: AnchorUndoState | null = null;
type ClearUndoPaneState = {
  beforeVersionId: number | null;
  afterVersionId: number | null;
  pane: WorkspacePaneState;
  saveTargets: PaneSaveTarget[];
};

type ClearUndoState = {
  snapshot: AnchorSnapshot;
  left: ClearUndoPaneState;
  right: ClearUndoPaneState;
  status: "armed" | "restored";
  mode: "all" | "pane";
  targetSide?: "left" | "right";
};

let clearUndoState: ClearUndoState | null = null;
let suppressClearUndoSync = false;

function getCurrentAnchorState(): WorkspaceAnchorState {
  return {
    manualAnchors: manualAnchors.map((anchor) => ({ ...anchor })),
    autoAnchor: autoAnchor ? { ...autoAnchor } : null,
    suppressedAutoAnchorKey,
    pendingLeftLineNo,
    pendingRightLineNo,
    selectedAnchorKey,
  };
}

function isGutterClick(event: monaco.editor.IEditorMouseEvent): boolean {
  const targetType = event.target.type;
  return (
    targetType === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS ||
    targetType === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN
  );
}

leftEditor.onMouseDown((event) => {
  if (!isGutterClick(event)) {
    return;
  }
  const lineNumber = event.target.position?.lineNumber;
  if (!lineNumber) {
    return;
  }
  handleLeftAnchorAction(lineNumber - 1);
});

rightEditor.onMouseDown((event) => {
  if (!isGutterClick(event)) {
    return;
  }
  const lineNumber = event.target.position?.lineNumber;
  if (!lineNumber) {
    return;
  }
  handleRightAnchorAction(lineNumber - 1);
});

function applyAnchorResult(result: AnchorClickResult, side: "left" | "right") {
  anchorUndoState = null;
  manualAnchors = result.manualAnchors;
  pendingLeftLineNo = result.pendingLeftLineNo;
  pendingRightLineNo = result.pendingRightLineNo;
  autoAnchor = result.autoAnchor;
  suppressedAutoAnchorKey = result.suppressedAutoAnchorKey;

  if (result.action === "auto-removed") {
    if (selectedAnchorKey === suppressedAutoAnchorKey) {
      selectedAnchorKey = null;
    }
  }
  const message = getAnchorActionMessage(result, side);
  if (message) {
    setAnchorMessage(message);
  }

  if (
    result.action === "added" ||
    result.action === "removed" ||
    result.action === "auto-removed"
  ) {
    recalcDiff();
  }
  updatePendingAnchorDecoration();
  const validation = validateAnchors(
    manualAnchors,
    getNormalizedLineCount(leftEditor.getValue()),
    getNormalizedLineCount(rightEditor.getValue()),
  );
  updateAnchorWarning(validation.invalid);
  renderAnchors(validation.invalid, validation.valid);
  schedulePersistAll();
}

function getAnchorActionMessage(
  result: AnchorClickResult,
  side: "left" | "right",
): string | null {
  if (result.action === "removed" && result.removedAnchor) {
    return `Anchor removed: ${formatAnchor(result.removedAnchor)}`;
  }
  if (result.action === "auto-removed") {
    return "Auto anchor removed.";
  }
  if (result.action === "added" && result.addedAnchor) {
    return `Anchor added: ${formatAnchor(result.addedAnchor)}`;
  }
  if (result.action === "pending-cleared") {
    return side === "left"
      ? "左行の選択を解除しました。"
      : "右行の選択を解除しました。";
  }
  if (result.action === "pending-set") {
    return side === "left"
      ? "左行を選択しました。右行を選んでください。"
      : "右行を選択しました。左行を選んでください。";
  }
  return null;
}

function handleLeftAnchorAction(lineNo: number) {
  runAnchorAction(lineNo, "left", handleLeftAnchorClick);
}

function handleRightAnchorAction(lineNo: number) {
  runAnchorAction(lineNo, "right", handleRightAnchorClick);
}

function buildAnchorClickState(lineNo: number) {
  return {
    manualAnchors,
    pendingLeftLineNo,
    pendingRightLineNo,
    autoAnchor,
    suppressedAutoAnchorKey,
    lineNo,
  };
}

function runAnchorAction(
  lineNo: number,
  side: "left" | "right",
  handler: (state: ReturnType<typeof buildAnchorClickState>) => AnchorClickResult,
) {
  const result = handler(buildAnchorClickState(lineNo));
  applyAnchorResult(result, side);
}

type ZoneSide = "insert" | "delete";

type ViewZoneSpec = {
  afterLineNumber: number;
  heightInLines?: number;
  heightInPx?: number;
  className: string;
  label?: string;
};

type FoldZoneSpec = {
  afterLineNumber: number;
  heightInLines: number;
  className: string;
  label: string;
  onClick: () => void;
};

type DerivedDiffCache = {
  opsSignature: string;
  segmentSignature: string;
  decorationVariantKey: string;
  foldRanges: FoldRange[];
  decorations: {
    left: monaco.editor.IModelDeltaDecoration[];
    right: monaco.editor.IModelDeltaDecoration[];
  };
  viewZones: {
    left: ViewZoneSpec[];
    right: ViewZoneSpec[];
  };
  fileZones: {
    left: ViewZoneSpec[];
    right: ViewZoneSpec[];
  };
};

const foldOptions = {
  threshold: 8,
  keepHead: 3,
  keepTail: 3,
};
let derivedDiffCache: DerivedDiffCache | null = null;

function setAnchorMessage(message: string) {
  anchorMessage.textContent = message;
}

type FileLineInfo = {
  fileIndex: number | null;
  fileName?: string;
  localLine: number;
};

function getFileLineInfo(segments: LineSegment[], lineNo: number): FileLineInfo {
  const info = getLineSegmentInfo(segments, lineNo + 1);
  if (!info) {
    return { fileIndex: null, localLine: lineNo + 1 };
  }
  return { fileIndex: info.fileIndex, fileName: info.fileName, localLine: info.localLine };
}

function formatLineWithFile(side: "L" | "R", info: FileLineInfo): string {
  if (info.fileIndex === null) {
    return `${side}${info.localLine}`;
  }
  return `${side}${info.localLine}[F${info.fileIndex}]`;
}

function formatAnchor(anchor: Anchor): string {
  const leftInfo = getFileLineInfo(leftSegments, anchor.leftLineNo);
  const rightInfo = getFileLineInfo(rightSegments, anchor.rightLineNo);
  return `${formatLineWithFile("L", leftInfo)} ↔ ${formatLineWithFile("R", rightInfo)}`;
}

function anchorKey(anchor: Anchor): string {
  return `${anchor.leftLineNo}:${anchor.rightLineNo}`;
}

function manualAnchorKey(anchor: Anchor): string {
  return `manual:${anchorKey(anchor)}`;
}

function autoAnchorKey(anchor: Anchor): string {
  return `auto:${anchorKey(anchor)}`;
}

function updatePendingAnchorDecoration() {
  if (pendingLeftLineNo === null) {
    pendingLeftDecorationIds = leftEditor.deltaDecorations(pendingLeftDecorationIds, []);
  } else {
    const line = pendingLeftLineNo + 1;
    pendingLeftDecorationIds = leftEditor.deltaDecorations(pendingLeftDecorationIds, [
      {
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: "anchor-pending-line",
        },
      },
      {
        range: new monaco.Range(line, 1, line, 2),
        options: {
          glyphMarginClassName: "anchor-pending-glyph",
        },
      },
    ]);
  }

  if (pendingRightLineNo === null) {
    pendingRightDecorationIds = rightEditor.deltaDecorations(
      pendingRightDecorationIds,
      [],
    );
  } else {
    const line = pendingRightLineNo + 1;
    pendingRightDecorationIds = rightEditor.deltaDecorations(pendingRightDecorationIds, [
      {
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: "anchor-pending-line",
        },
      },
      {
        range: new monaco.Range(line, 1, line, 2),
        options: {
          glyphMarginClassName: "anchor-pending-glyph",
        },
      },
    ]);
  }
}

function resetAllAnchorsAndDecorations(): void {
  const next = resetAllAnchors(
    {
      manualAnchors,
      autoAnchor,
      suppressedAutoAnchorKey,
      pendingLeftLineNo,
      pendingRightLineNo,
      selectedAnchorKey,
      pendingLeftDecorationIds,
      pendingRightDecorationIds,
      leftAnchorDecorationIds,
      rightAnchorDecorationIds,
      leftFocusDecorationIds,
      rightFocusDecorationIds,
    },
    { leftEditor, rightEditor },
  );

  manualAnchors = next.manualAnchors;
  autoAnchor = next.autoAnchor;
  suppressedAutoAnchorKey = next.suppressedAutoAnchorKey;
  pendingLeftLineNo = next.pendingLeftLineNo;
  pendingRightLineNo = next.pendingRightLineNo;
  selectedAnchorKey = next.selectedAnchorKey;
  pendingLeftDecorationIds = next.pendingLeftDecorationIds;
  pendingRightDecorationIds = next.pendingRightDecorationIds;
  leftAnchorDecorationIds = next.leftAnchorDecorationIds;
  rightAnchorDecorationIds = next.rightAnchorDecorationIds;
  leftFocusDecorationIds = next.leftFocusDecorationIds;
  rightFocusDecorationIds = next.rightFocusDecorationIds;
}

function updateAnchorWarning(invalid: { anchor: Anchor; reasons: string[] }[]) {
  if (invalid.length === 0) {
    anchorWarning.textContent = "";
    return;
  }

  const message = invalid
    .map((item) => {
      const leftInfo = getFileLineInfo(leftSegments, item.anchor.leftLineNo);
      const rightInfo = getFileLineInfo(rightSegments, item.anchor.rightLineNo);
      return `${formatLineWithFile("L", leftInfo)} ↔ ${formatLineWithFile("R", rightInfo)}: ${item.reasons.join(" / ")}`;
    })
    .join(" | ");
  anchorWarning.textContent = `無効なアンカーがあります: ${message}`;
}

type AnchorEntry = {
  anchor: Anchor;
  source: "manual" | "auto";
};

function renderAnchors(
  invalid: { anchor: Anchor; reasons: string[] }[],
  valid: Anchor[],
) {
  anchorValidationState = { invalid, valid };
  anchorEntryKeys = [];
  anchorEntryMap.clear();
  anchorList.innerHTML = "";
  const entries: AnchorEntry[] = [];
  if (autoAnchor) {
    entries.push({ anchor: autoAnchor, source: "auto" });
  }
  manualAnchors.forEach((anchor) => {
    entries.push({ anchor, source: "manual" });
  });
  if (entries.length === 0) {
    const empty = document.createElement("li");
    empty.className = "anchor-empty";
    empty.textContent = "アンカーはありません";
    anchorList.appendChild(empty);
    return;
  }

  const invalidMap = new Map<Anchor, string>();
  invalid.forEach((item) => {
    invalidMap.set(item.anchor, item.reasons.join(" / "));
  });
  const validSet = new Set(valid);

  entries.forEach((entry) => {
    const anchor = entry.anchor;
    const item = document.createElement("li");
    item.className = "anchor-item";
    if (entry.source === "auto") {
      item.classList.add("is-auto");
    }
    const entryKey =
      entry.source === "auto" ? autoAnchorKey(anchor) : manualAnchorKey(anchor);
    if (selectedAnchorKey === entryKey) {
      item.classList.add("is-selected");
    }
    const leftInfo = getFileLineInfo(leftSegments, anchor.leftLineNo);
    const rightInfo = getFileLineInfo(rightSegments, anchor.rightLineNo);
    const reason = entry.source === "manual" ? invalidMap.get(anchor) : undefined;

    const label = document.createElement("span");
    label.className = "anchor-link";
    if (entry.source === "auto") {
      label.classList.add("anchor-auto");
    }
    const createLinePart = (side: "L" | "R", info: FileLineInfo) => {
      const wrapper = document.createElement("span");
      wrapper.className = "anchor-side";

      const lineText = document.createElement("span");
      lineText.className = "anchor-line";
      lineText.textContent = `${side}${info.localLine}`;
      wrapper.appendChild(lineText);

      if (info.fileIndex !== null) {
        const badge = document.createElement("span");
        const paletteIndex = ((info.fileIndex - 1) % 4) + 1;
        badge.className = `anchor-file-badge file-index-${paletteIndex}`;
        badge.textContent = `F${info.fileIndex}`;
        if (info.fileName) {
          badge.title = info.fileName;
        }
        wrapper.appendChild(badge);
      }

      return wrapper;
    };

    if (entry.source === "auto") {
      const prefix = document.createElement("span");
      prefix.className = "anchor-auto-prefix";
      prefix.textContent = "AUTO:DOCTYPE";
      label.appendChild(prefix);
    }

    label.appendChild(createLinePart("L", leftInfo));
    const separator = document.createElement("span");
    separator.className = "anchor-separator";
    separator.textContent = "↔";
    label.appendChild(separator);
    label.appendChild(createLinePart("R", rightInfo));

    if (reason) {
      label.classList.add("anchor-invalid");
      const reasonText = document.createElement("span");
      reasonText.className = "anchor-reason";
      reasonText.textContent = `（無効: ${reason}）`;
      label.appendChild(reasonText);
    } else if (entry.source === "manual" && !validSet.has(anchor)) {
      label.classList.add("anchor-disabled");
    }

    const canJump = entry.source === "auto" || validSet.has(anchor);
    anchorEntryKeys.push(entryKey);
    anchorEntryMap.set(entryKey, { anchor, canJump });
    if (canJump) {
      item.addEventListener("click", (event) => {
        if ((event.target as HTMLElement).closest(".anchor-remove")) {
          return;
        }
        selectedAnchorKey = entryKey;
        renderAnchors(invalid, valid);
        leftEditor.revealLineInCenter(anchor.leftLineNo + 1);
        rightEditor.revealLineInCenter(anchor.rightLineNo + 1);
        focusDiffLines(anchor.leftLineNo, anchor.rightLineNo);
        setAnchorMessage(`Anchor jump: ${formatAnchor(anchor)}`);
        anchorList.focus();
        scheduleWorkspacePersist();
      });
    }

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "anchor-remove";
    removeButton.textContent = "削除";
    removeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      removeButton.blur();
      if (entry.source === "auto") {
        suppressedAutoAnchorKey = autoAnchorKey(anchor);
        autoAnchor = null;
        if (selectedAnchorKey === entryKey) {
          selectedAnchorKey = null;
        }
        setAnchorMessage("Auto anchor removed.");
        recalcDiff();
      } else {
        const manualIndex = manualAnchors.indexOf(anchor);
        if (manualIndex === -1) {
          return;
        }
        const removed = manualAnchors[manualIndex];
        manualAnchors = manualAnchors.filter((_, anchorIndex) => anchorIndex !== manualIndex);
        if (selectedAnchorKey === entryKey) {
          selectedAnchorKey = null;
        }
        setAnchorMessage(`Anchor removed: ${formatAnchor(removed)}`);
        recalcDiff();
      }
      const validation = validateAnchors(
        manualAnchors,
        getNormalizedLineCount(leftEditor.getValue()),
        getNormalizedLineCount(rightEditor.getValue()),
      );
      updateAnchorWarning(validation.invalid);
      renderAnchors(validation.invalid, validation.valid);
      schedulePersistAll();
    });

    item.appendChild(label);
    item.appendChild(removeButton);
    anchorList.appendChild(item);
  });
}

function jumpToAnchorEntry(entryKey: string) {
  const entry = anchorEntryMap.get(entryKey);
  if (!entry || !entry.canJump) {
    return;
  }
  leftEditor.revealLineInCenter(entry.anchor.leftLineNo + 1);
  rightEditor.revealLineInCenter(entry.anchor.rightLineNo + 1);
  focusDiffLines(entry.anchor.leftLineNo, entry.anchor.rightLineNo);
  setAnchorMessage(`Anchor jump: ${formatAnchor(entry.anchor)}`);
}

function getNormalizedLineCount(text: string): number {
  return normalizeText(text).split("\n").length;
}

function findDoctypeLineIndex(text: string): number {
  const lines = normalizeText(text).split("\n");
  const pattern = /<(!|！)DOCTYPE/i;
  for (let index = 0; index < lines.length; index += 1) {
    if (pattern.test(lines[index])) {
      return index;
    }
  }
  return -1;
}

function getAutoDoctypeAnchor(leftText: string, rightText: string): Anchor | null {
  const leftIndex = findDoctypeLineIndex(leftText);
  const rightIndex = findDoctypeLineIndex(rightText);
  if (leftIndex === -1 || rightIndex === -1) {
    return null;
  }
  return { leftLineNo: leftIndex, rightLineNo: rightIndex };
}

function anchorsEqual(left: Anchor, right: Anchor): boolean {
  return left.leftLineNo === right.leftLineNo && left.rightLineNo === right.rightLineNo;
}

function addLineDecoration(
  target: monaco.editor.IModelDeltaDecoration[],
  lineNo: number,
  className: string,
) {
  target.push({
    range: new monaco.Range(lineNo + 1, 1, lineNo + 1, 1),
    options: { isWholeLine: true, className },
  });
}

function addInlineDecorations(
  target: monaco.editor.IModelDeltaDecoration[],
  lineNo: number,
  ranges: { start: number; end: number }[],
  className: string,
) {
  for (const range of ranges) {
    if (range.start >= range.end) {
      continue;
    }
    target.push({
      range: new monaco.Range(lineNo + 1, range.start + 1, lineNo + 1, range.end + 1),
      options: { inlineClassName: className },
    });
  }
}

function buildDecorationSignatures(
  decorations: readonly monaco.editor.IModelDeltaDecoration[],
): string[] {
  return decorations.map((decoration) => {
    const { range, options } = decoration;
    const rangeSignature = [
      range.startLineNumber,
      range.startColumn,
      range.endLineNumber,
      range.endColumn,
    ].join(":");
    const optionSignature = JSON.stringify(options);
    return `${rangeSignature}|${optionSignature}`;
  });
}

function buildZoneSignatures(
  zones: readonly ViewZoneSpec[],
): string[] {
  return zones.map((zone) =>
    [
      zone.afterLineNumber,
      zone.heightInLines ?? "",
      zone.heightInPx ?? "",
      zone.className,
      zone.label ?? "",
    ].join("|"),
  );
}

function canIgnoreLeadingFileWhitespaceFromEditorText(text: string): boolean {
  const normalized = normalizeText(text);
  return normalized.length === 0 || normalized[0] !== "\n";
}

function buildDecorations(
  ops: PairedOp[],
  options: {
    displayDiffs?: Array<ReplaceDisplayDiff | null>;
    ignoreLeadingFileWhitespace: boolean;
    leftLeadingFileWhitespaceEligible: boolean;
    rightLeadingFileWhitespaceEligible: boolean;
  },
): {
  left: monaco.editor.IModelDeltaDecoration[];
  right: monaco.editor.IModelDeltaDecoration[];
} {
  const left: monaco.editor.IModelDeltaDecoration[] = [];
  const right: monaco.editor.IModelDeltaDecoration[] = [];

  for (let index = 0; index < ops.length; index += 1) {
    const op = ops[index];
    const displayDiff = options.displayDiffs?.[index] ?? null;
    if (op.type === "insert" && op.rightLineNo !== undefined) {
      addLineDecoration(right, op.rightLineNo, "line-insert");
      continue;
    }

    if (op.type === "delete" && op.leftLineNo !== undefined) {
      addLineDecoration(left, op.leftLineNo, "line-delete");
      continue;
    }

    if (op.type === "replace" && op.leftLineNo !== undefined && op.rightLineNo !== undefined) {
      addLineDecoration(left, op.leftLineNo, "line-replace");
      addLineDecoration(right, op.rightLineNo, "line-replace");

      const inline =
        displayDiff?.inline ??
        diffInlineWithAppendLiteral(op.leftLine ?? "", op.rightLine ?? "", {
          ignoreLeadingFileWhitespace: options.ignoreLeadingFileWhitespace,
          leftLineNo: op.leftLineNo,
          rightLineNo: op.rightLineNo,
          leftLeadingFileWhitespaceEligible: options.leftLeadingFileWhitespaceEligible,
          rightLeadingFileWhitespaceEligible: options.rightLeadingFileWhitespaceEligible,
        });
      addInlineDecorations(left, op.leftLineNo, inline.leftRanges, "inline-delete");
      addInlineDecorations(right, op.rightLineNo, inline.rightRanges, "inline-insert");
      const spaceRanges =
        displayDiff?.spaceRanges ??
        extractHtmlAttributeSpaceDiffRangesPair(
          op.leftLine ?? "",
          op.rightLine ?? "",
          inline.leftRanges,
          inline.rightRanges,
        );
      addInlineDecorations(left, op.leftLineNo, spaceRanges.left, "inline-space-diff");
      addInlineDecorations(right, op.rightLineNo, spaceRanges.right, "inline-space-diff");
    }
  }

  return { left, right };
}

function buildPairedOpSignature(op: PairedOp): string {
  const leftLineNo = op.leftLineNo ?? "";
  const rightLineNo = op.rightLineNo ?? "";
  const leftLine = op.leftLine ?? "";
  const rightLine = op.rightLine ?? "";
  return `${op.type}|${leftLineNo}|${rightLineNo}|${leftLine}|${rightLine}`;
}

function buildPairedOpsSignature(ops: readonly PairedOp[]): string {
  return ops.map((op) => buildPairedOpSignature(op)).join("\n");
}

function buildSegmentsSignature(segments: readonly LineSegment[]): string {
  return segments
    .map((segment) =>
      [
        segment.fileIndex,
        segment.fileName ?? "",
        segment.startLine,
        segment.lineCount,
      ].join("|"),
    )
    .join("\n");
}

function buildViewZones(ops: PairedOp[]): {
  left: ViewZoneSpec[];
  right: ViewZoneSpec[];
} {
  const left: ViewZoneSpec[] = [];
  const right: ViewZoneSpec[] = [];
  let consumedLeftLines = 0;
  let consumedRightLines = 0;

  const pushZone = (
    target: ViewZoneSpec[],
    side: ZoneSide,
    afterLineNumber: number,
    heightInLines: number,
  ) => {
    if (heightInLines <= 0) {
      return;
    }
    const className = side === "insert" ? "diff-zone-insert" : "diff-zone-delete";
    target.push({ afterLineNumber, heightInLines, className });
  };

  const appendOrExtendZone = (
    target: ViewZoneSpec[],
    side: ZoneSide,
    afterLineNumber: number,
    heightInLines: number,
  ) => {
    const className = side === "insert" ? "diff-zone-insert" : "diff-zone-delete";
    const last = target[target.length - 1];
    if (
      last &&
      last.className === className &&
      last.afterLineNumber === afterLineNumber
    ) {
      last.heightInLines += heightInLines;
      return;
    }
    pushZone(target, side, afterLineNumber, heightInLines);
  };

  for (const op of ops) {
    if (op.type === "equal" || op.type === "replace") {
      consumedLeftLines += 1;
      consumedRightLines += 1;
      continue;
    }

    if (op.type === "insert") {
      consumedRightLines += 1;
      const afterLineNumber = Math.max(consumedLeftLines, 0);
      appendOrExtendZone(left, "insert", afterLineNumber, 1);
      continue;
    }

    if (op.type === "delete") {
      consumedLeftLines += 1;
      const afterLineNumber = Math.max(consumedRightLines, 0);
      appendOrExtendZone(right, "delete", afterLineNumber, 1);
    }
  }

  return { left, right };
}

function applyViewZones(
  editor: monaco.editor.IStandaloneCodeEditor,
  currentZoneIds: string[],
  zones: ViewZoneSpec[],
): string[] {
  return applyZones(editor, currentZoneIds, zones, (zone) => {
    const domNode = document.createElement("div");
    domNode.className = zone.className;
    if (zone.label) {
      domNode.textContent = zone.label;
    }
    return domNode;
  });
}

function applyFoldZones(
  editor: monaco.editor.IStandaloneCodeEditor,
  currentZoneIds: string[],
  zones: FoldZoneSpec[],
): string[] {
  return applyZones(editor, currentZoneIds, zones, (zone) => {
    const domNode = document.createElement("div");
    domNode.className = zone.className;
    domNode.textContent = zone.label;
    domNode.addEventListener("click", zone.onClick);
    return domNode;
  });
}

function applyZones<T extends {
  afterLineNumber: number;
  heightInLines?: number;
  heightInPx?: number;
}>(
  editor: monaco.editor.IStandaloneCodeEditor,
  currentZoneIds: string[],
  zones: T[],
  buildDomNode: (zone: T) => HTMLElement,
): string[] {
  const nextZoneIds: string[] = [];

  editor.changeViewZones((accessor: monaco.editor.IViewZoneChangeAccessor) => {
    for (const zoneId of currentZoneIds) {
      accessor.removeZone(zoneId);
    }

    for (const zone of zones) {
      const domNode = buildDomNode(zone);
      const zoneId = accessor.addZone({
        afterLineNumber: zone.afterLineNumber,
        heightInLines: zone.heightInLines,
        heightInPx: zone.heightInPx,
        domNode,
      });
      nextZoneIds.push(zoneId);
    }
  });

  return nextZoneIds;
}

function buildHiddenAreas(folds: FoldRange[]): {
  left: monaco.IRange[];
  right: monaco.IRange[];
} {
  const left: monaco.IRange[] = [];
  const right: monaco.IRange[] = [];

  for (const fold of folds) {
    if (expandedFoldStarts.has(fold.startRow)) {
      continue;
    }
    const startLines = mapRowToLineNumbers(pairedOps, fold.hiddenStartRow);
    const endLines = mapRowToLineNumbers(pairedOps, fold.hiddenEndRow);

    left.push(new monaco.Range(startLines.leftLineNo + 1, 1, endLines.leftLineNo + 1, 1));
    right.push(
      new monaco.Range(startLines.rightLineNo + 1, 1, endLines.rightLineNo + 1, 1),
    );
  }

  return { left, right };
}

function buildFoldZones(folds: FoldRange[]): { left: FoldZoneSpec[]; right: FoldZoneSpec[] } {
  const left: FoldZoneSpec[] = [];
  const right: FoldZoneSpec[] = [];

  for (const fold of folds) {
    if (expandedFoldStarts.has(fold.startRow)) {
      continue;
    }
    const label = `... 省略（${fold.hiddenCount}行） ...`;
    const startLines = mapRowToLineNumbers(pairedOps, fold.hiddenStartRow);
    const onClick = () => {
      expandedFoldStarts.add(fold.startRow);
      applyFolding();
    };

    left.push({
      afterLineNumber: startLines.leftLineNo,
      heightInLines: 1,
      className: "diff-fold-placeholder",
      label,
      onClick,
    });
    right.push({
      afterLineNumber: startLines.rightLineNo,
      heightInLines: 1,
      className: "diff-fold-placeholder",
      label,
      onClick,
    });
  }

  return { left, right };
}

function applyFolding() {
  if (!foldEnabled) {
    setEditorHiddenAreas(leftEditor, []);
    setEditorHiddenAreas(rightEditor, []);
    leftFoldZoneIds = applyFoldZones(leftEditor, leftFoldZoneIds, []);
    rightFoldZoneIds = applyFoldZones(rightEditor, rightFoldZoneIds, []);
    return;
  }

  const hiddenAreas = buildHiddenAreas(foldRanges);
  setEditorHiddenAreas(leftEditor, hiddenAreas.left);
  setEditorHiddenAreas(rightEditor, hiddenAreas.right);

  const zones = buildFoldZones(foldRanges);
  leftFoldZoneIds = applyFoldZones(leftEditor, leftFoldZoneIds, zones.left);
  rightFoldZoneIds = applyFoldZones(rightEditor, rightFoldZoneIds, zones.right);
}

function setEditorHiddenAreas(
  editor: monaco.editor.IStandaloneCodeEditor,
  ranges: monaco.IRange[],
) {
  // Monaco's type definitions may not expose setHiddenAreas, so we guard at runtime.
  const editorWithHidden = editor as monaco.editor.IStandaloneCodeEditor & {
    setHiddenAreas?: (areas: monaco.IRange[]) => void;
  };
  if (editorWithHidden.setHiddenAreas) {
    editorWithHidden.setHiddenAreas(ranges);
  } else {
    console.warn("setHiddenAreas is not available on this Monaco build.");
  }
}

function recalcDiff() {
  const recalcStartedAt = performance.now();
  const leftText = leftEditor.getValue();
  const rightText = rightEditor.getValue();
  const leftLeadingFileWhitespaceEligible =
    canIgnoreLeadingFileWhitespaceFromEditorText(leftText);
  const rightLeadingFileWhitespaceEligible =
    canIgnoreLeadingFileWhitespaceFromEditorText(rightText);
  const decorationVariantKey = [
    ignoreLeadingFileWhitespace ? "1" : "0",
    leftLeadingFileWhitespaceEligible ? "1" : "0",
    rightLeadingFileWhitespaceEligible ? "1" : "0",
  ].join("|");
  const anchorValidationStartedAt = performance.now();
  const validation = validateAnchors(
    manualAnchors,
    getNormalizedLineCount(leftText),
    getNormalizedLineCount(rightText),
  );

  if (validation.invalid.length > 0) {
    console.warn("無効なアンカーが検出されました:", validation.invalid);
  }

  let anchorsForDiff = validation.valid;
  autoAnchor = null;
  const autoCandidate = getAutoDoctypeAnchor(leftText, rightText);
  if (autoCandidate) {
    const candidateKey = autoAnchorKey(autoCandidate);
    if (suppressedAutoAnchorKey && suppressedAutoAnchorKey !== candidateKey) {
      suppressedAutoAnchorKey = null;
    }
    if (suppressedAutoAnchorKey !== candidateKey) {
      const candidate = addAnchor(validation.valid, autoCandidate);
      const candidateValidation = validateAnchors(
        candidate,
        getNormalizedLineCount(leftText),
        getNormalizedLineCount(rightText),
      );
      const autoValid =
        candidateValidation.valid.some((anchor) =>
          anchorsEqual(anchor, autoCandidate),
        ) &&
        candidateValidation.invalid.every(
          (issue) => !anchorsEqual(issue.anchor, autoCandidate),
        );
      if (autoValid) {
        anchorsForDiff = candidateValidation.valid;
        autoAnchor = autoCandidate;
      } else {
        console.warn("Auto DOCTYPE anchor skipped due to conflicts.");
      }
    }
  }

  updateAnchorWarning(validation.invalid);
  renderAnchors(validation.invalid, validation.valid);
  const anchorValidationMs = performance.now() - anchorValidationStartedAt;

  const diffComputeStartedAt = performance.now();
  if (anchorsForDiff.length > 0) {
    pairedOps = diffEngine.diffWithAnchors(leftText, rightText, anchorsForDiff, {
      ignoreLeadingFileWhitespace,
    });
  } else {
    pairedOps = pairReplace(
      diffEngine.diffLines(leftText, rightText, {
        ignoreLeadingFileWhitespace,
      }),
    );
  }
  const diffComputeMs = performance.now() - diffComputeStartedAt;

  const normalizeStartedAt = performance.now();
  const preparedReplaceOps = prepareReplaceOpsForDisplay(pairedOps, {
    ignoreLeadingFileWhitespace,
    leftLeadingFileWhitespaceEligible,
    rightLeadingFileWhitespaceEligible,
  });
  pairedOps = preparedReplaceOps.ops;
  const normalizeMs = performance.now() - normalizeStartedAt;

  const deriveStartedAt = performance.now();
  const opsSignature = buildPairedOpsSignature(pairedOps);
  const segmentSignature = `${buildSegmentsSignature(leftSegments)}\n---\n${buildSegmentsSignature(rightSegments)}`;
  const useCachedDerived =
    derivedDiffCache !== null &&
    derivedDiffCache.opsSignature === opsSignature &&
    derivedDiffCache.segmentSignature === segmentSignature &&
    derivedDiffCache.decorationVariantKey === decorationVariantKey;
  const nextDerived = useCachedDerived
    ? derivedDiffCache
    : {
        opsSignature,
        segmentSignature,
        decorationVariantKey,
        foldRanges: buildFoldRanges(pairedOps, foldOptions),
        decorations: buildDecorations(pairedOps, {
          displayDiffs: preparedReplaceOps.displayDiffs,
          ignoreLeadingFileWhitespace,
          leftLeadingFileWhitespaceEligible,
          rightLeadingFileWhitespaceEligible,
        }),
        viewZones: buildViewZones(pairedOps),
        fileZones: buildAlignedFileBoundaryZones(pairedOps, leftSegments, rightSegments),
      };
  if (!useCachedDerived) {
    derivedDiffCache = nextDerived;
  }

  diffBlockStarts = getDiffBlockStarts(pairedOps);
  currentBlockIndex = 0;
  foldRanges = nextDerived.foldRanges;
  expandedFoldStarts.clear();
  const { left, right } = nextDerived.decorations;
  const anchorDecorations = buildAnchorDecorations(
    validation.valid,
    autoAnchor,
    (line, startColumn, endColumn) => new monaco.Range(line, startColumn, line, endColumn),
  );
  const zones = nextDerived.viewZones;
  const fileZones = nextDerived.fileZones;
  const findOffsets = buildFindWidgetOffsetZones(leftEditor, rightEditor);
  const leftZones = findOffsets.left.concat(zones.left, fileZones.left);
  const rightZones = findOffsets.right.concat(zones.right, fileZones.right);
  const deriveMs = performance.now() - deriveStartedAt;

  const renderStartedAt = performance.now();
  const forceRenderRefresh = diffRenderingInvalidated;
  const nextLeftDecorationSignatures = buildDecorationSignatures(left);
  if (
    shouldApplyBySignature(
      leftDecorationSignatures,
      nextLeftDecorationSignatures,
      leftDecorationIds,
      { force: forceRenderRefresh },
    )
  ) {
    leftDecorationIds = leftEditor.deltaDecorations(leftDecorationIds, left);
    leftDecorationSignatures = nextLeftDecorationSignatures;
  }
  const nextRightDecorationSignatures = buildDecorationSignatures(right);
  if (
    shouldApplyBySignature(
      rightDecorationSignatures,
      nextRightDecorationSignatures,
      rightDecorationIds,
      { force: forceRenderRefresh },
    )
  ) {
    rightDecorationIds = rightEditor.deltaDecorations(rightDecorationIds, right);
    rightDecorationSignatures = nextRightDecorationSignatures;
  }
  const nextLeftAnchorSignatures = buildDecorationSignatures(anchorDecorations.left);
  if (
    shouldApplyBySignature(
      leftAnchorDecorationSignatures,
      nextLeftAnchorSignatures,
      leftAnchorDecorationIds,
      { force: forceRenderRefresh },
    )
  ) {
    leftAnchorDecorationIds = leftEditor.deltaDecorations(
      leftAnchorDecorationIds,
      anchorDecorations.left,
    );
    leftAnchorDecorationSignatures = nextLeftAnchorSignatures;
  }
  const nextRightAnchorSignatures = buildDecorationSignatures(anchorDecorations.right);
  if (
    shouldApplyBySignature(
      rightAnchorDecorationSignatures,
      nextRightAnchorSignatures,
      rightAnchorDecorationIds,
      { force: forceRenderRefresh },
    )
  ) {
    rightAnchorDecorationIds = rightEditor.deltaDecorations(
      rightAnchorDecorationIds,
      anchorDecorations.right,
    );
    rightAnchorDecorationSignatures = nextRightAnchorSignatures;
  }
  updatePendingAnchorDecoration();
  const nextLeftZoneSignatures = buildZoneSignatures(leftZones);
  if (
    shouldApplyBySignature(
      leftZoneSignatures,
      nextLeftZoneSignatures,
      leftZoneIds,
      { force: forceRenderRefresh },
    )
  ) {
    leftZoneIds = applyViewZones(leftEditor, leftZoneIds, leftZones);
    leftZoneSignatures = nextLeftZoneSignatures;
  }
  const nextRightZoneSignatures = buildZoneSignatures(rightZones);
  if (
    shouldApplyBySignature(
      rightZoneSignatures,
      nextRightZoneSignatures,
      rightZoneIds,
      { force: forceRenderRefresh },
    )
  ) {
    rightZoneIds = applyViewZones(rightEditor, rightZoneIds, rightZones);
    rightZoneSignatures = nextRightZoneSignatures;
  }
  diffRenderingInvalidated = false;
  updateDiffJumpButtons(prevButton, nextButton, diffBlockStarts.length > 0);
  applyFolding();
  focusDiffLines(null, null);
  const renderMs = performance.now() - renderStartedAt;

  diffViewerPerf.recordRecalc({
    diffBlockCount: diffBlockStarts.length,
    pairedOpCount: pairedOps.length,
    phases: {
      anchorValidationMs,
      deriveMs,
      diffComputeMs,
      normalizeMs,
      renderMs,
    },
    totalMs: performance.now() - recalcStartedAt,
    usedCachedDerived: useCachedDerived,
  });
}

function buildPaneClearOptions(
  side: "left" | "right",
  config: {
    editor: monaco.editor.IStandaloneCodeEditor;
    segments: LineSegment[];
    message: HTMLDivElement;
  },
) {
  return {
    editor: config.editor,
    segments: config.segments,
    updateLineNumbers,
    onBeforeClear: () => {
      anchorUndoState = null;
      clearUndoState = {
        snapshot: captureAnchorSnapshot(),
        left: {
          beforeVersionId: getEditorAlternativeVersionId(leftEditor),
          afterVersionId: null,
          pane: collectWorkspacePaneSnapshot("left"),
          saveTargets: clonePaneSaveTargets(paneSaveTargetLists.left),
        },
        right: {
          beforeVersionId: getEditorAlternativeVersionId(rightEditor),
          afterVersionId: null,
          pane: collectWorkspacePaneSnapshot("right"),
          saveTargets: clonePaneSaveTargets(paneSaveTargetLists.right),
        },
        status: "armed",
        mode: "pane",
        targetSide: side,
      };
    },
    onAfterClear: () => {
      if (clearUndoState?.mode === "pane" && clearUndoState.targetSide === side) {
        if (side === "left") {
          clearUndoState.left.afterVersionId = getEditorAlternativeVersionId(leftEditor);
        } else {
          clearUndoState.right.afterVersionId = getEditorAlternativeVersionId(rightEditor);
        }
      }
      resetAllAnchorsAndDecorations();
      clearPaneSourceState(side);
      updateFileCards(side, []);
      resetPaneMessage(config.message);
      clearPaneSummary(storage, side);
      refreshSyntaxHighlight();
      recalcDiff();
      schedulePersistAll();
    },
  };
}

const leftClearOptions = buildPaneClearOptions("left", {
  editor: leftEditor,
  segments: leftSegments,
  message: leftMessage,
});
const rightClearOptions = buildPaneClearOptions("right", {
  editor: rightEditor,
  segments: rightSegments,
  message: rightMessage,
});

bindPaneClearButton(leftClearButton, leftClearOptions);
bindPaneClearButton(rightClearButton, rightClearOptions);

function buildPaneCopyText(side: "left" | "right"): string {
  const rows = buildVisualRowsForCopy();
  return buildCopyTextFromVisualRows(rows, side);
}

function buildVisualRowsForCopy() {
  const fileZones = derivedDiffCache?.fileZones ?? { left: [], right: [] };
  return buildCopyVisualRowsFromAlignedDiff(pairedOps, fileZones);
}

function buildVisualRowsForReport() {
  const sourceZones = derivedDiffCache?.fileZones ?? { left: [], right: [] };
  const fileZones = {
    left: sourceZones.left.map((zone) => ({
      ...zone,
      label: stripFileBoundaryLabelPrefix(zone.label),
    })),
    right: sourceZones.right.map((zone) => ({
      ...zone,
      label: stripFileBoundaryLabelPrefix(zone.label),
    })),
  };
  return buildCopyVisualRowsFromAlignedDiff(pairedOps, fileZones);
}

function getCurrentReportTheme(): "light" | "dark" {
  const mode = document.documentElement.dataset.theme;
  return mode === "dark" ? "dark" : "light";
}

function getCurrentReportHighlight(): "on" | "off" {
  const state = document.documentElement.dataset.highlight;
  return state === "off" ? "off" : "on";
}

function mapMonacoTokenTypeToReportClass(tokenType: string): string | null {
  const normalized = tokenType.toLowerCase();
  if (!normalized || normalized === "source" || normalized === "white") {
    return null;
  }
  if (normalized.includes("comment")) {
    return "syntax-comment";
  }
  if (normalized.includes("string")) {
    return "syntax-string";
  }
  if (normalized.includes("regexp")) {
    return "syntax-regexp";
  }
  if (normalized.includes("number")) {
    return "syntax-number";
  }
  if (normalized.includes("keyword")) {
    return "syntax-keyword";
  }
  if (
    normalized.includes("type") ||
    normalized.includes("class") ||
    normalized.includes("namespace") ||
    normalized.includes("interface") ||
    normalized.includes("enum")
  ) {
    return "syntax-type";
  }
  if (normalized.includes("tag")) {
    return "syntax-tag";
  }
  if (normalized.includes("attribute")) {
    return "syntax-attribute";
  }
  if (normalized.includes("operator")) {
    return "syntax-operator";
  }
  if (normalized.includes("delimiter") || normalized.includes("punctuation")) {
    return "syntax-delimiter";
  }
  return null;
}

function tokenizeLineForReportSyntax(
  line: string,
  language: string,
): DiffReportSyntaxRange[] {
  if (!line || !language || language === "plaintext") {
    return [];
  }
  const tokenLines = monaco.editor.tokenize(line, language) as Array<
    Array<{ offset: number; type: string }>
  >;
  const tokens = tokenLines[0] ?? [];
  if (tokens.length === 0) {
    return [];
  }
  const ranges: DiffReportSyntaxRange[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const next = tokens[index + 1];
    const start = Math.max(0, Math.min(line.length, token.offset));
    const end = Math.max(start, Math.min(line.length, next?.offset ?? line.length));
    if (end <= start) {
      continue;
    }
    const className = mapMonacoTokenTypeToReportClass(token.type ?? "");
    if (!className) {
      continue;
    }
    const last = ranges[ranges.length - 1];
    if (last && last.className === className && last.end === start) {
      last.end = end;
      continue;
    }
    ranges.push({ start, end, className });
  }
  return ranges;
}

bindPaneSourceCopyButton({
  button: leftCopyButton,
  side: "left",
  doc: document,
  copy: copyText,
  toast,
  getText: () => buildPaneCopyText("left"),
});

bindPaneSourceCopyButton({
  button: rightCopyButton,
  side: "right",
  doc: document,
  copy: copyText,
  toast,
  getText: () => buildPaneCopyText("right"),
});

let reportMode: ReportMode = "simple";
bindReportModeMenu({
  triggerButton: reportModeToggleButton,
  menu: reportModeMenu,
  simpleButton: reportModeSimpleButton,
  richButton: reportModeRichButton,
  initialMode: reportMode,
  onChange: (nextMode) => {
    reportMode = nextMode;
  },
});

bindExportReportButton({
  button: exportReportButton,
  doc: document,
  toast,
  buildHtml: () => {
    const syntaxHighlightEnabled = reportMode === "rich" && highlightToggle.checked;
    const rows = buildReportRowsFromVisualRows(buildVisualRowsForReport(), {
      leftSegments,
      rightSegments,
      ignoreLeadingFileWhitespace,
      syntaxHighlightEnabled,
      leftLanguage: getPaneLanguage(leftSegments),
      rightLanguage: getPaneLanguage(rightSegments),
      tokenizeLine: tokenizeLineForReportSyntax,
    });
    return buildDiffReportHtml(rows, {
      mode: reportMode,
      theme: getCurrentReportTheme(),
      highlight: getCurrentReportHighlight(),
    });
  },
  fileName: "diff-report.html",
});

function clearFocusedPane(): void {
  if (lastFocusedSide === "left") {
    clearPaneState(leftClearOptions);
  } else {
    clearPaneState(rightClearOptions);
  }
}

function clearAllPanes(): void {
  const confirmed = window.confirm("左右の内容とアンカーを全てクリアします。よろしいですか？");
  if (!confirmed) {
    return;
  }
  const targetSide = lastFocusedSide;
  const targetEditor = targetSide === "left" ? leftEditor : rightEditor;
  anchorUndoState = null;
  clearUndoState = {
    snapshot: captureAnchorSnapshot(),
    left: {
      beforeVersionId: getEditorAlternativeVersionId(leftEditor),
      afterVersionId: null,
      pane: collectWorkspacePaneSnapshot("left"),
      saveTargets: clonePaneSaveTargets(paneSaveTargetLists.left),
    },
    right: {
      beforeVersionId: getEditorAlternativeVersionId(rightEditor),
      afterVersionId: null,
      pane: collectWorkspacePaneSnapshot("right"),
      saveTargets: clonePaneSaveTargets(paneSaveTargetLists.right),
    },
    status: "armed",
    mode: "all",
  };
  cancelPersist();
  void clearPersistedState(storage, { textStore });
  withPersistSuppressed(() => {
    clearEditorsForUndo([leftEditor, rightEditor], targetEditor);
    leftSegments.length = 0;
    rightSegments.length = 0;
    clearPaneSourceState("left");
    clearPaneSourceState("right");
    resetAllAnchorsAndDecorations();
    updateFileCards("left", []);
    updateFileCards("right", []);
    resetPaneMessage(leftMessage);
    resetPaneMessage(rightMessage);
    clearPaneSummary(storage, "left");
    clearPaneSummary(storage, "right");
    updateLineNumbers(leftEditor, leftSegments);
    updateLineNumbers(rightEditor, rightSegments);
    refreshSyntaxHighlight();
    recalcDiff();
    setAnchorMessage("アンカーを全てクリアしました。");
    scheduleWorkspacePersist();
  });
  if (clearUndoState) {
    clearUndoState.left.afterVersionId = getEditorAlternativeVersionId(leftEditor);
    clearUndoState.right.afterVersionId = getEditorAlternativeVersionId(rightEditor);
  }
}

clearButton.addEventListener("click", () => {
  clearAllPanes();
});

const syncToggle = document.querySelector<HTMLInputElement>("#sync-toggle");
if (syncToggle) {
  syncToggle.checked = persistedState?.scrollSync ?? true;
  scrollSync.setEnabled(syncToggle.checked);
  syncToggle.addEventListener("change", (event: Event) => {
    scrollSync.setEnabled((event.target as HTMLInputElement).checked);
    schedulePersist();
  });
}

bindIgnoreLeadingWhitespaceToggle({
  input: ignoreLeadingWhitespaceToggle,
  initialEnabled: false,
  onChange: (enabled) => {
    ignoreLeadingFileWhitespace = enabled;
  },
  onAfterToggle: () => {
    recalcDiff();
  },
});

const foldToggle = document.querySelector<HTMLInputElement>("#fold-toggle");
if (foldToggle) {
  foldToggle.checked = foldEnabled;
  foldToggle.addEventListener("change", (event: Event) => {
    foldEnabled = (event.target as HTMLInputElement).checked;
    applyFolding();
    schedulePersist();
  });
}

if (persistedState) {
  recalcDiff();
}

function focusDiffLines(
  leftLineNo: number | null,
  rightLineNo: number | null,
) {
  if (leftLineNo === null || rightLineNo === null) {
    leftFocusDecorationIds = leftEditor.deltaDecorations(
      leftFocusDecorationIds,
      [],
    );
    rightFocusDecorationIds = rightEditor.deltaDecorations(
      rightFocusDecorationIds,
      [],
    );
    return;
  }

  const leftDecorations: monaco.editor.IModelDeltaDecoration[] = [
    {
      range: new monaco.Range(leftLineNo + 1, 1, leftLineNo + 1, 1),
      options: {
        isWholeLine: true,
        className: "line-focus",
        glyphMarginClassName: "line-focus-glyph",
      },
    },
  ];
  const rightDecorations: monaco.editor.IModelDeltaDecoration[] = [
    {
      range: new monaco.Range(rightLineNo + 1, 1, rightLineNo + 1, 1),
      options: {
        isWholeLine: true,
        className: "line-focus",
        glyphMarginClassName: "line-focus-glyph",
      },
    },
  ];

  leftFocusDecorationIds = leftEditor.deltaDecorations(
    leftFocusDecorationIds,
    leftDecorations,
  );
  rightFocusDecorationIds = rightEditor.deltaDecorations(
    rightFocusDecorationIds,
    rightDecorations,
  );
}

function ensureRowVisible(rowIndex: number) {
  if (!foldEnabled) {
    return;
  }
  const fold = findFoldContainingRow(foldRanges, rowIndex);
  if (fold && !expandedFoldStarts.has(fold.startRow)) {
    expandedFoldStarts.add(fold.startRow);
    applyFolding();
  }
}

function revealBlock(index: number) {
  if (diffBlockStarts.length === 0) {
    return;
  }
  const rowIndex = diffBlockStarts[index];
  ensureRowVisible(rowIndex);
  const { leftLineNo, rightLineNo } = mapRowToLineNumbers(pairedOps, rowIndex);

  leftEditor.revealLineInCenter(leftLineNo + 1);
  rightEditor.revealLineInCenter(rightLineNo + 1);
  focusDiffLines(leftLineNo, rightLineNo);
}

prevButton?.addEventListener("click", () => {
  if (diffBlockStarts.length === 0) {
    return;
  }
  currentBlockIndex = Math.max(0, currentBlockIndex - 1);
  revealBlock(currentBlockIndex);
});

nextButton?.addEventListener("click", () => {
  if (diffBlockStarts.length === 0) {
    return;
  }
  currentBlockIndex = Math.min(diffBlockStarts.length - 1, currentBlockIndex + 1);
  revealBlock(currentBlockIndex);
});

recalcDiff();

// Worker確認手順:
// 1) pnpm install
// 2) pnpm run dev
// 3) ブラウザコンソールで "Could not create web worker(s)" が出ないことを確認
