export function runPostLoadTasks(tasks: Array<() => void>): void {
  for (const task of tasks) {
    try {
      task();
    } catch (error) {
      console.warn("Post-load task failed:", error);
    }
  }
}
