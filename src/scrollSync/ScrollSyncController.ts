export type ScrollChangeEvent = {
  scrollTop: number;
  scrollLeft: number;
};

export type ScrollAdapter = {
  onDidScrollChange: (handler: (event: ScrollChangeEvent) => void) => void;
  setScrollTop: (value: number) => void;
  setScrollLeft: (value: number) => void;
};

type ScheduleNextFrame = (callback: () => void) => void;

export class ScrollSyncController {
  private enabled = true;
  private isSyncing = false;
  private syncSource: "left" | "right" | null = null;
  private pendingSourceScroll: { source: "left" | "right"; event: ScrollChangeEvent } | null =
    null;
  private scheduleNextFrame: ScheduleNextFrame;

  constructor(
    private left: ScrollAdapter,
    private right: ScrollAdapter,
    scheduleNextFrame: ScheduleNextFrame = (callback) => requestAnimationFrame(callback),
  ) {
    this.scheduleNextFrame = scheduleNextFrame;
    this.left.onDidScrollChange((event) => this.handleScroll("left", event));
    this.right.onDidScrollChange((event) => this.handleScroll("right", event));
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private handleScroll(source: "left" | "right", event: ScrollChangeEvent): void {
    if (!this.enabled) {
      return;
    }

    if (this.isSyncing) {
      if (source === this.syncSource) {
        this.pendingSourceScroll = { source, event };
      }
      return;
    }

    this.isSyncing = true;
    this.syncSource = source;
    const target = source === "left" ? this.right : this.left;

    // Reflect both axes so the other editor follows precisely.
    target.setScrollTop(event.scrollTop);
    target.setScrollLeft(event.scrollLeft);

    // Release the lock on the next frame to avoid feedback loops.
    this.scheduleNextFrame(() => {
      this.isSyncing = false;
      this.syncSource = null;
      const pending = this.pendingSourceScroll;
      this.pendingSourceScroll = null;
      if (pending) {
        this.handleScroll(pending.source, pending.event);
      }
    });
  }
}
