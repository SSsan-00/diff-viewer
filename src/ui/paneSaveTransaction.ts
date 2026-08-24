export type PaneSaveCommitGuard<Context> = Readonly<{
  expectedContext: Context;
  isCurrent: (expectedContext: Context) => boolean;
}>;

export type PaneSaveTransactionResult<Target, WriteItem, Context> =
  | { status: "committed"; writeItems: WriteItem[] }
  | { status: "permission-denied"; target: Target }
  | { status: "context-changed"; expectedContext: Context };

export type PaneSaveTransactionParams<
  Target,
  SourceFile,
  WriteItem,
  Context,
> = {
  targets: readonly Target[];
  cachedSourceFiles: readonly SourceFile[];
  getTargetName: (target: Target) => string;
  getSourceFileName: (file: SourceFile) => string;
  loadSourceFile: (target: Target, index: number) => Promise<SourceFile>;
  buildWriteItems: (
    sourceFiles: readonly SourceFile[],
    targets: readonly Target[],
  ) => WriteItem[] | Promise<WriteItem[]>;
  requestPermission: (target: Target) => Promise<boolean>;
  commitGuard: PaneSaveCommitGuard<Context>;
  write: (item: WriteItem, index: number) => Promise<void>;
};

export async function runPaneSaveTransaction<
  Target,
  SourceFile,
  WriteItem,
  Context,
>(
  params: PaneSaveTransactionParams<Target, SourceFile, WriteItem, Context>,
): Promise<PaneSaveTransactionResult<Target, WriteItem, Context>> {
  const targets = [...params.targets];
  const cachedSourceFiles = [...params.cachedSourceFiles];
  const cacheMatchesTargets =
    cachedSourceFiles.length === targets.length &&
    cachedSourceFiles.every(
      (file, index) =>
        params.getSourceFileName(file) ===
        params.getTargetName(targets[index]),
    );
  const sourceFiles = cacheMatchesTargets
    ? cachedSourceFiles
    : await Promise.all(
        targets.map((target, index) => params.loadSourceFile(target, index)),
      );
  const writeItems = await params.buildWriteItems(sourceFiles, targets);

  for (const target of targets) {
    if (!(await params.requestPermission(target))) {
      return { status: "permission-denied", target };
    }
  }

  if (!params.commitGuard.isCurrent(params.commitGuard.expectedContext)) {
    return {
      status: "context-changed",
      expectedContext: params.commitGuard.expectedContext,
    };
  }

  for (let index = 0; index < writeItems.length; index += 1) {
    await params.write(writeItems[index], index);
  }
  return { status: "committed", writeItems };
}
