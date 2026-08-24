export type PaneReloadCommitGuard<Context> = Readonly<{
  expectedContext: Context;
  isCurrent: (expectedContext: Context) => boolean;
}>;

export type PaneReloadTransactionResult<Target, Prepared> =
  | { status: "committed"; prepared: Prepared }
  | { status: "permission-denied"; target: Target };

export type GuardedPaneReloadTransactionResult<Target, Prepared, Context> =
  | PaneReloadTransactionResult<Target, Prepared>
  | { status: "context-changed"; expectedContext: Context };

type PaneReloadTransactionParams<Target, Loaded, Prepared> = {
  targets: readonly Target[];
  requestPermission: (target: Target) => Promise<boolean>;
  load: (target: Target, index: number) => Promise<Loaded>;
  prepare: (
    loaded: Loaded[],
    targets: readonly Target[],
  ) => Prepared | Promise<Prepared>;
  commit: (prepared: Prepared) => void;
};

export function runPaneReloadTransaction<Target, Loaded, Prepared, Context>(
  params: PaneReloadTransactionParams<Target, Loaded, Prepared> & {
    commitGuard: PaneReloadCommitGuard<Context>;
  },
): Promise<GuardedPaneReloadTransactionResult<Target, Prepared, Context>>;

export function runPaneReloadTransaction<Target, Loaded, Prepared>(
  params: PaneReloadTransactionParams<Target, Loaded, Prepared> & {
    commitGuard?: undefined;
  },
): Promise<PaneReloadTransactionResult<Target, Prepared>>;

export async function runPaneReloadTransaction<
  Target,
  Loaded,
  Prepared,
  Context,
>(
  params: PaneReloadTransactionParams<Target, Loaded, Prepared> & {
    commitGuard?: PaneReloadCommitGuard<Context>;
  },
): Promise<GuardedPaneReloadTransactionResult<Target, Prepared, Context>> {
  const targets = [...params.targets];

  for (const target of targets) {
    if (!(await params.requestPermission(target))) {
      return { status: "permission-denied", target };
    }
  }

  const loaded = await Promise.all(
    targets.map((target, index) => params.load(target, index)),
  );
  const prepared = await params.prepare(loaded, targets);
  if (
    params.commitGuard &&
    !params.commitGuard.isCurrent(params.commitGuard.expectedContext)
  ) {
    return {
      status: "context-changed",
      expectedContext: params.commitGuard.expectedContext,
    };
  }
  params.commit(prepared);
  return { status: "committed", prepared };
}
