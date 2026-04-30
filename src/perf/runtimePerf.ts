import type { DiffEngineStatus } from "../diffEngine/engine";

export type RecalcPerfPhases = {
  anchorValidationMs: number;
  deriveMs: number;
  diffComputeMs: number;
  normalizeMs: number;
  renderMs: number;
};

export type RecalcPerfSnapshot = {
  diffBlockCount: number;
  pairedOpCount: number;
  phases: RecalcPerfPhases;
  totalMs: number;
  usedCachedDerived: boolean;
};

export type DiffViewerPerfSnapshot = {
  engine: DiffEngineStatus;
  lastRecalc: RecalcPerfSnapshot | null;
};

export type DiffViewerPerfMonitor = {
  clearLastRecalc: () => void;
  getSnapshot: () => DiffViewerPerfSnapshot;
  recordRecalc: (snapshot: RecalcPerfSnapshot) => void;
};

function cloneRecalcPerfSnapshot(snapshot: RecalcPerfSnapshot): RecalcPerfSnapshot {
  return {
    ...snapshot,
    phases: { ...snapshot.phases },
  };
}

export function createDiffViewerPerfMonitor(
  getEngineStatus: () => DiffEngineStatus,
): DiffViewerPerfMonitor {
  let lastRecalc: RecalcPerfSnapshot | null = null;

  return {
    clearLastRecalc: () => {
      lastRecalc = null;
    },
    getSnapshot: () => ({
      engine: { ...getEngineStatus() },
      lastRecalc: lastRecalc ? cloneRecalcPerfSnapshot(lastRecalc) : null,
    }),
    recordRecalc: (snapshot) => {
      lastRecalc = cloneRecalcPerfSnapshot(snapshot);
    },
  };
}
