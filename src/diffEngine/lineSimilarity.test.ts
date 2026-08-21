import { describe, expect, it } from "vitest";
import { buildLineFeatures, scoreLinePair } from "./lineSimilarity";

describe("buildLineFeatures", () => {
  it("classifies declarations without rebuilding regexes per call", () => {
    expect(buildLineFeatures("public async Task Run()").category).toBe("decl");
    expect(buildLineFeatures("function renderView() {").category).toBe("decl");
  });

  it("classifies calls and ordinary statements distinctly", () => {
    expect(buildLineFeatures("handler.execute(value);").category).toBe("call");
    expect(buildLineFeatures("value = other + 1;").category).toBe("assign");
    expect(buildLineFeatures("value == other").category).toBe("other");
    expect(buildLineFeatures("value <= other").category).toBe("other");
  });

  it("keeps the declaration name as the primary identifier", () => {
    expect(buildLineFeatures("public async Task Run()").primaryId).toBe("run");
  });

  it("uses assignment targets and callees as strong primary identifiers", () => {
    expect(buildLineFeatures("const total = oldValue;").primaryId).toBe("total");
    expect(buildLineFeatures("this.total = newValue;").primaryId).toBe("total");
    expect(buildLineFeatures("renderView(oldValue);").primaryId).toBe("renderview");
    expect(buildLineFeatures("ui.renderView(newValue);").primaryId).toBe("renderview");
  });

  it("keeps awaited and returned invocations in the call category", () => {
    expect(buildLineFeatures("await service.fetch(value);")).toMatchObject({
      category: "call",
      primaryId: "fetch",
    });
    expect(buildLineFeatures("return render(value);")).toMatchObject({
      category: "call",
      primaryId: "render",
    });
  });

  it("does not count identifiers inside string literals a second time", () => {
    expect(buildLineFeatures('logger.write("sharedToken");').identifiers).not.toContain(
      "sharedtoken",
    );
  });

  it("counts repeated identifier overlap only once", () => {
    const repeated = scoreLinePair(
      buildLineFeatures("render(render);"),
      buildLineFeatures("render();"),
    );
    const unique = scoreLinePair(
      buildLineFeatures("render();"),
      buildLineFeatures("render();"),
    );

    expect(repeated).toBe(unique);
  });
});
