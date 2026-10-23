import { describe, expect, it } from "vitest";
import { areEquivalentTemplateIfSignatures, extractTemplateIfSignature } from "./templateIf";

describe("PHP and Razor if signatures", () => {
  it.each([
    ['<? if($msg != "") { ?>', '@if(Model.msg != "")'],
    ['<?php if($msg != "") { ?>', '@if(Model.msg != "")'],
    ['\t<?\tif\t( $msg\t!=\t"" )\t{\t?>', '  @if ( Model . msg != "" )'],
    ['<? if($msg != "") { ?>', '@if(Model.msg != "") {'],
  ])("aligns the same simple PHP and Razor if condition: %s", (php, razor) => {
    expect(areEquivalentTemplateIfSignatures(extractTemplateIfSignature(php), extractTemplateIfSignature(razor))).toBe(true);
    expect(areEquivalentTemplateIfSignatures(extractTemplateIfSignature(razor), extractTemplateIfSignature(php))).toBe(true);
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
    expect(areEquivalentTemplateIfSignatures(extractTemplateIfSignature(left), extractTemplateIfSignature(right))).toBe(false);
    expect(areEquivalentTemplateIfSignatures(extractTemplateIfSignature(right), extractTemplateIfSignature(left))).toBe(false);
  });

  it("does not align two lines from the same dialect", () => {
    expect(
      areEquivalentTemplateIfSignatures(extractTemplateIfSignature('<? if($msg != "") { ?>'), extractTemplateIfSignature('<?php if($msg != "") { ?>')),
    ).toBe(false);
    expect(
      areEquivalentTemplateIfSignatures(extractTemplateIfSignature('@if(Model.msg != "")'), extractTemplateIfSignature('@if ( Model.msg != "" )')),
    ).toBe(false);
  });
});
