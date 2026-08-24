import { normalizeText } from "../diffEngine/normalize";
import type { AnchorSide } from "./anchorTracking";
import {
  appendDecodedFiles,
  type DecodedFilesResult,
  type FileBytes,
} from "../file/decodedFiles";
import type { FileEncoding } from "../file/decode";
import type { LineSegment } from "../file/lineNumbering";
import { normalizeLastSegmentForAppend } from "../file/segmentAppend";
import type { WorkspaceAnchorState } from "../storage/workspaces";
import {
  updateAnchorStateForPaneAppend,
  type AnchorLifecycleResult,
  type AnchorLineCounts,
} from "./anchorLifecycle";

export type TrackedPaneAppendOptions = {
  side: AnchorSide;
  currentText: string;
  currentSegments: readonly LineSegment[];
  incomingFiles: FileBytes[];
  encoding: FileEncoding;
  anchorState: WorkspaceAnchorState;
  lineCounts: AnchorLineCounts;
};

export type TrackedPaneAppendResult = DecodedFilesResult & {
  anchorResult: AnchorLifecycleResult;
};

export type TrackedPaneAppendCommitGuard<Context> = Readonly<{
  expectedContext: Context;
  isCurrent: (expectedContext: Context) => boolean;
}>;

export type TrackedPaneAppendContext = Readonly<{
  side: AnchorSide;
  operationGeneration: number;
  workspaceId: string;
  contentRevision: number;
  modelVersionId: number | null;
  selectedEncoding: FileEncoding;
  segmentsSignature: string;
  saveTargetsRevision: number;
}>;

export function sameTrackedPaneAppendContext(
  expected: TrackedPaneAppendContext,
  current: TrackedPaneAppendContext,
): boolean {
  return (
    expected.side === current.side &&
    expected.operationGeneration === current.operationGeneration &&
    expected.workspaceId === current.workspaceId &&
    expected.contentRevision === current.contentRevision &&
    expected.modelVersionId === current.modelVersionId &&
    expected.selectedEncoding === current.selectedEncoding &&
    expected.segmentsSignature === current.segmentsSignature &&
    expected.saveTargetsRevision === current.saveTargetsRevision
  );
}

export type TrackedPaneAppendTransactionResult<Prepared, Context> =
  | { status: "committed"; prepared: Prepared }
  | { status: "context-changed"; expectedContext: Context };

export async function runTrackedPaneAppendTransaction<
  Item,
  Loaded,
  Prepared,
  Context,
>(options: {
  items: readonly Item[];
  load: (item: Item, index: number) => Promise<Loaded>;
  prepare: (loaded: Loaded[]) => Prepared | Promise<Prepared>;
  commit: (prepared: Prepared) => void;
  commitGuard: TrackedPaneAppendCommitGuard<Context>;
}): Promise<TrackedPaneAppendTransactionResult<Prepared, Context>> {
  const loaded = await Promise.all(
    [...options.items].map((item, index) => options.load(item, index)),
  );
  const prepared = await options.prepare(loaded);
  if (!options.commitGuard.isCurrent(options.commitGuard.expectedContext)) {
    return {
      status: "context-changed",
      expectedContext: options.commitGuard.expectedContext,
    };
  }
  options.commit(prepared);
  return { status: "committed", prepared };
}

export function prepareTrackedPaneAppend(
  options: TrackedPaneAppendOptions,
): TrackedPaneAppendResult {
  const previousSegments = options.currentSegments.map((segment) => ({
    ...segment,
  }));
  normalizeLastSegmentForAppend(previousSegments, options.currentText);
  const appended = appendDecodedFiles(
    options.currentText,
    previousSegments,
    options.incomingFiles,
    options.encoding,
  );
  const nextLineCounts = { ...options.lineCounts };
  const nextLineCount = normalizeText(appended.text).split("\n").length;
  if (options.side === "left") {
    nextLineCounts.leftLineCount = nextLineCount;
  } else {
    nextLineCounts.rightLineCount = nextLineCount;
  }

  return {
    ...appended,
    anchorResult: updateAnchorStateForPaneAppend(
      options.anchorState,
      options.side,
      {
        text: options.currentText,
        segments: previousSegments,
      },
      {
        text: appended.text,
        segments: appended.segments,
      },
      nextLineCounts,
    ),
  };
}
