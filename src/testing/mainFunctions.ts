import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Execute the actual wiring without starting Monaco or the application's global listeners.
export function loadMainFunctions(names: string[], context: Record<string, unknown>) {
  const source = ts.createSourceFile("main.ts", readFileSync(new URL("../main.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
  const declarations = names.map((name) => {
    let node: ts.FunctionDeclaration | undefined;
    function visit(child: ts.Node): void {
      if (ts.isFunctionDeclaration(child) && child.name?.text === name) node = child;
      if (!node) ts.forEachChild(child, visit);
    }
    visit(source);
    if (!node) throw new Error(`Missing main function: ${name}`);
    return node.getText(source);
  }).join("\n");
  return runInNewContext(ts.transpileModule(declarations, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + `\n({${names.join(",")}})`, context);
}
