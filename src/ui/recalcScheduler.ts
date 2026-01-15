export type RecalcScheduler = {
  schedule: () => void;
  runNow: () => void;
};

export function createRecalcScheduler(
  run: () => void,
  delayMs = 200,
): RecalcScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let pending = false;

  const runInternal = () => {
    if (inFlight) {
      pending = true;
      return;
    }
    inFlight = true;
    try {
      run();
    } finally {
      inFlight = false;
      if (pending) {
        pending = false;
        schedule();
      }
    }
  };

  const schedule = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      runInternal();
    }, delayMs);
  };

  const runNow = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    runInternal();
  };

  return { schedule, runNow };
}
