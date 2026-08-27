import { describe, expect, it } from "vitest";
import { areEquivalentPhpRazorIfLines } from "./templateIf";

describe("areEquivalentPhpRazorIfLines", () => {
  it.each([
    ['<? if($msg != "") { ?>', '@if(Model.msg != "")'],
    ['<?php if($msg != "") { ?>', '@if(Model.msg != "")'],
    ['\t<?\tif\t( $msg\t!=\t"" )\t{\t?>', '  @if ( Model . msg != "" )'],
    ['<? if($msg != "") { ?>', '@if(Model.msg != "") {'],
  ])("aligns the same simple PHP and Razor if condition: %s", (php, razor) => {
    expect(areEquivalentPhpRazorIfLines(php, razor)).toBe(true);
    expect(areEquivalentPhpRazorIfLines(razor, php)).toBe(true);
  });

  it.each([
    ['<? if($msg != "") { ?>', '@if(Model.other != "")'],
    ['<? if($msg != "") { ?>', '@if(Model.msg == "")'],
    ['<? if($msg !== "") { ?>', '@if(Model.msg !== "")'],
    ['<? if($msg != "") { ?>', '@if(Model.msg != "value")'],
    ["<? if($msg != 'value') { ?>", "@if(Model.msg != 'value')"],
    ['<? if($msg != "a b") { ?>', '@if(Model.msg != "ab")'],
    ['<? if($msg != "" && $enabled) { ?>', '@if(Model.msg != "" && Model.enabled)'],
    ['<? if($msg != "") { ?>', '@while(Model.msg != "")'],
    ['<? if($msg != "") { ?>', '@:if(Model.msg != "")'],
    ['<? if($msg != "") { ?>', 'if(Model.msg != "")'],
    ['<? if($msg != "") { ?>', 'Model.msg = "";'],
    ['<? if($msg != "") { ?>', 'msg();'],
    ['<? while($msg != "") { ?>', '@if(Model.msg != "")'],
    ['<? php if($msg != "") { ?>', '@if(Model.msg != "")'],
    ['<? if($msg != ""): ?>', '@if(Model.msg != "")'],
    ['<? if($msg != "") { // note ?>', '@if(Model.msg != "")'],
    ['<? if($msg != "") { ?>', '@if(Model.msg != "") // note'],
  ])("rejects a different or non-target construct: %s / %s", (left, right) => {
    expect(areEquivalentPhpRazorIfLines(left, right)).toBe(false);
    expect(areEquivalentPhpRazorIfLines(right, left)).toBe(false);
  });

  it("does not align two lines from the same dialect", () => {
    expect(
      areEquivalentPhpRazorIfLines(
        '<? if($msg != "") { ?>',
        '<?php if($msg != "") { ?>',
      ),
    ).toBe(false);
    expect(
      areEquivalentPhpRazorIfLines(
        '@if(Model.msg != "")',
        '@if ( Model.msg != "" )',
      ),
    ).toBe(false);
  });
});
