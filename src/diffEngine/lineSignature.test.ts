import { describe, expect, it } from "vitest";
import { extractLineKey } from "./lineSignature";

describe("extractLineKey", () => {
  it("normalizes php tag wrapped brace lines", () => {
    expect(extractLineKey("{")).toBe("brace_open");
    expect(extractLineKey("<? { ?>")).toBe("brace_open");
    expect(extractLineKey("}")).toBe("brace_close");
    expect(extractLineKey("<? } ?>")).toBe("brace_close");
  });

  it("uses inner function names for php embedded outputs and Razor Html.Raw calls", () => {
    expect(extractLineKey("<?= SetMetaTag() ?>")).toBe("setmetatag");
    expect(extractLineKey("<?php RenderHeadMeta(); ?>")).toBe("renderheadmeta");
    expect(extractLineKey("<? EmitBodyMeta(); ?>")).toBe("emitbodymeta");
    expect(extractLineKey("<? echo EmitAnalyticsTag(); ?>")).toBe("emitanalyticstag");
    expect(extractLineKey("<?php echo WriteAnalyticsTag(); ?>")).toBe("writeanalyticstag");
    expect(extractLineKey("@Html.Raw(SetMetaTag())")).toBe("setmetatag");
  });
});
