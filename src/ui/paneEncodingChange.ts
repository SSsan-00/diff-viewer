export type PaneEncodingChangeResult<Value> =
  | { status: "committed"; appliedValue: Value }
  | { status: "prepare-failed"; appliedValue: Value; error: unknown };

export type PaneEncodingChangeHooks<Value, Prepared> = {
  prepare: (nextValue: Value) => Prepared;
  commit: (prepared: Prepared) => void;
  restoreSelection: (appliedValue: Value) => void;
  refreshControls: () => void;
};

export type PaneEncodingChangeController<Value> = {
  getAppliedValue: () => Value;
  apply: <Prepared>(
    nextValue: Value,
    hooks: PaneEncodingChangeHooks<Value, Prepared>,
  ) => PaneEncodingChangeResult<Value>;
};

export function createPaneEncodingChangeController<Value>(
  initialValue: Value,
): PaneEncodingChangeController<Value> {
  let appliedValue = initialValue;

  return {
    getAppliedValue: () => appliedValue,
    apply: (nextValue, hooks) => {
      let prepared: ReturnType<typeof hooks.prepare>;
      try {
        prepared = hooks.prepare(nextValue);
      } catch (error) {
        hooks.restoreSelection(appliedValue);
        hooks.refreshControls();
        return { status: "prepare-failed", appliedValue, error };
      }

      hooks.commit(prepared);
      appliedValue = nextValue;
      hooks.refreshControls();
      return { status: "committed", appliedValue };
    },
  };
}
