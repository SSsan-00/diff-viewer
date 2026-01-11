import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import { conf as csharpConf, language as csharpLanguage } from "monaco-editor/esm/vs/basic-languages/csharp/csharp.js";
import { conf as cssConf, language as cssLanguage } from "monaco-editor/esm/vs/basic-languages/css/css.js";
import { conf as htmlConf, language as htmlLanguage } from "monaco-editor/esm/vs/basic-languages/html/html.js";
import {
  conf as javascriptConf,
  language as javascriptLanguage,
} from "monaco-editor/esm/vs/basic-languages/javascript/javascript.js";
import {
  conf as markdownConf,
  language as markdownLanguage,
} from "monaco-editor/esm/vs/basic-languages/markdown/markdown.js";
import { conf as phpConf, language as phpLanguage } from "monaco-editor/esm/vs/basic-languages/php/php.js";
import {
  conf as typescriptConf,
  language as typescriptLanguage,
} from "monaco-editor/esm/vs/basic-languages/typescript/typescript.js";

export function registerBasicLanguages(): void {
  const registerLanguage = (id: string, conf: object, language: object) => {
    monaco.languages.register({ id });
    monaco.languages.setLanguageConfiguration(id, conf);
    monaco.languages.setMonarchTokensProvider(id, language);
  };

  registerLanguage("csharp", csharpConf, csharpLanguage);
  registerLanguage("css", cssConf, cssLanguage);
  registerLanguage("html", htmlConf, htmlLanguage);
  registerLanguage("javascript", javascriptConf, javascriptLanguage);
  registerLanguage("markdown", markdownConf, markdownLanguage);
  registerLanguage("php", phpConf, phpLanguage);
  registerLanguage("typescript", typescriptConf, typescriptLanguage);

  monaco.languages.register({ id: "json" });
  monaco.languages.setMonarchTokensProvider("json", {
    tokenizer: {
      root: [
        [/[{}[\]]/, "@brackets"],
        [/"[^"\\]*(?:\\.[^"\\]*)*"/, "string"],
        [/\b-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?\b/, "number"],
        [/\b(true|false|null)\b/, "keyword"],
        [/[,:]/, "delimiter"],
        [/\s+/, "white"],
      ],
    },
  });
}
