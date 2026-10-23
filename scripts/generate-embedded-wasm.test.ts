import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("./generate-embedded-wasm.mjs", import.meta.url));
const directories: string[] = [];

afterEach(() => {
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

function createFixture() {
  const directory = mkdtempSync(join(tmpdir(), "diff-viewer-wasm-"));
  directories.push(directory);
  const sourceDirectory = join(directory, "src", "diffEngine");
  mkdirSync(sourceDirectory, { recursive: true });
  return { directory, output: join(sourceDirectory, "embeddedDiffWasm.ts") };
}

function generate(directory: string) {
  return execFileSync(process.execPath, [script], {
    cwd: directory,
    env: { ...process.env, DIFF_VIEWER_REQUIRE_WASM: "0" },
    encoding: "utf8",
  });
}

describe("embedded wasm generation without a Rust project", () => {
  it.each(["", ': "ready" | "missing_manifest"'])("preserves ready bytes with status annotation %s", (annotation) => {
    const fixture = createFixture();
    const source = `export const EMBEDDED_DIFF_WASM_STATUS${annotation} = "ready";\nexport const EMBEDDED_DIFF_WASM_BYTES = new Uint8Array([1]);\n`;
    writeFileSync(fixture.output, source);

    expect(generate(fixture.directory)).toContain("preserved ready");
    expect(readFileSync(fixture.output, "utf8")).toBe(source);
  });

  it("emits a typed fallback when no ready module exists", () => {
    const fixture = createFixture();

    expect(generate(fixture.directory)).toContain("missing_manifest");
    const source = readFileSync(fixture.output, "utf8");
    expect(source).toContain('EMBEDDED_DIFF_WASM_STATUS: "ready" |');
    expect(source).toContain('= "missing_manifest";');
    expect(source).toContain("new Uint8Array([])");
  });
});
