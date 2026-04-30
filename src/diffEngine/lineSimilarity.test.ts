import { describe, expect, it } from "vitest";
import { buildLineFeatures } from "./lineSimilarity";

describe("buildLineFeatures", () => {
  it("classifies declarations without rebuilding regexes per call", () => {
    expect(buildLineFeatures("public async Task Run()").category).toBe("decl");
    expect(buildLineFeatures("function renderView() {").category).toBe("decl");
  });

  it("classifies calls and ordinary statements distinctly", () => {
    expect(buildLineFeatures("handler.execute(value);").category).toBe("call");
    expect(buildLineFeatures("value = other + 1;").category).toBe("other");
  });

  it("keeps the declaration name as the primary identifier", () => {
    expect(buildLineFeatures("public async Task Run()").primaryId).toBe("run");
  });
});
