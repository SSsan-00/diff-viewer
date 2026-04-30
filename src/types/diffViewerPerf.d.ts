import type { DiffViewerPerfMonitor } from "../perf/runtimePerf";

declare global {
  interface Window {
    __diffViewerPerf?: DiffViewerPerfMonitor;
  }
}

export {};
