import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker&inline";

export function setupMonacoWorkers(): void {
  self.MonacoEnvironment = {
    getWorker() {
      return new editorWorker();
    },
  };
}
