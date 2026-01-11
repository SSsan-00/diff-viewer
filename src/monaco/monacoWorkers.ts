import editorWorker from "monaco-editor/esm/vs/editor/editor.worker.js?worker&inline";

export function setupMonacoWorkers(): void {
  self.MonacoEnvironment = {
    getWorker(_moduleId, label) {
      return new editorWorker();
    },
  };
}
