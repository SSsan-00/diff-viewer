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
  generation: number;
  lastRecalc: RecalcPerfSnapshot | null;
};

export type DiffViewerPerfMonitor = {
  clearLastRecalc: () => void;
  getSnapshot: () => DiffViewerPerfSnapshot;
  recordRecalc: (snapshot: RecalcPerfSnapshot) => void;
  requestRecalc: () => number;
};

function cloneRecalcPerfSnapshot(snapshot: RecalcPerfSnapshot): RecalcPerfSnapshot {
  return {
    ...snapshot,
    phases: { ...snapshot.phases },
  };
}

export function createDiffViewerPerfMonitor(
  getEngineStatus: () => DiffEngineStatus,
  requestRecalc: () => void = () => {},
): DiffViewerPerfMonitor {
  let lastRecalc: RecalcPerfSnapshot | null = null;
  let generation = 0;

  return {
    clearLastRecalc: () => {
      lastRecalc = null;
    },
    getSnapshot: () => ({
      engine: { ...getEngineStatus() },
      generation,
      lastRecalc: lastRecalc ? cloneRecalcPerfSnapshot(lastRecalc) : null,
    }),
    recordRecalc: (snapshot) => {
      lastRecalc = cloneRecalcPerfSnapshot(snapshot);
      generation += 1;
    },
    requestRecalc: () => {
      const previousGeneration = generation;
      requestRecalc();
      return previousGeneration;
    },
  };
}
