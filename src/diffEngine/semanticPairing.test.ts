import { afterEach, expect, it } from "vitest";
import { createDiffEngine } from "./engine";
import { pairReplace } from "./pairReplace";
import { extractArrayIfSignature } from "./arrayIf";
import { diffInlineWithAppendLiteral, setDiffInlineCore, setDiffInlineBatchCore } from "./diffInline";
import { extractHtmlAttributeSpaceDiffRangesPair } from "./htmlAttributeSpaceDiff";
import { buildDiffReportHtml } from "../ui/diffReport";

afterEach(() => { setDiffInlineCore(null); setDiffInlineBatchCore(null); });

it.each(["ts", "wasm"] as const)("pairs converted conditions, templates and comment prefixes with %s", async (mode) => {
  const engine = await createDiffEngine({ mode });
  const cases = [
    ...["s", "i", "m", "b"].map((method) => [
      `if($wdata['cfutan_flg'] != "1" && ($wdata['x'] == "a||b" || $wdata['y'] >= 2))`,
      `if(wdata["cfutan_flg"].${method}() != "1" && (wdata["x"].s() == "a||b" || wdata["y"].i() >= 2))`,
    ]),
    [`<input type="hidden" name="foo" value="<?= isset($data['foo']) ? $data['foo'] : "" ?>">`,
      `<input type="hidden" name="foo" value="@Html.Raw(isset(Model.data["foo"]) ? Model.data["foo"] : "")">`],
    ["<html>", '<html lang="ja">'],
    ["// XXX YYY", "// XXX"],
    ["// 入力チェック（必須項目）", "// 入力チェック"],
  ];
  for (const [left, right] of cases) for (const [a,b] of [[left,right],[right,left]]) {
    expect(pairReplace(engine.diffLines(a,b)).map((op) => op.type)).toEqual(["replace"]);
    expect(diffInlineWithAppendLiteral(a,b)).not.toEqual({ leftRanges: [], rightRanges: [] });
  }
  expect(diffInlineWithAppendLiteral("a\u200db", "a\u200dc")).toEqual({leftRanges:[{start:2,end:3}],rightRanges:[{start:2,end:3}]});
});

it("preserves condition structure and rejects unsupported syntax", () => {
  const key = (condition: string) => extractArrayIfSignature(`if (${condition})`);
  expect(key('$a["x"].s() != "1" && $b["y"] == 2')).toBeNull();
  expect(key('a["x"].t() != "1"')).toBeNull();
  expect(key('a["x"].s(value) != "1"')).toBeNull();
  expect(key('$a["x"] != "1"')?.key).not.toBe(key('a["x"].s() != 1')?.key);
  expect(key('$a["x"] != "1" && $b["y"] == 2')?.key).not.toBe(key('a["x"].s() != "1" || b["y"].i() == 2')?.key);
});

it("finds attribute spaces after embedded expressions", () => {
  for (const expression of ['<?= isset($data["foo"]) ? $data["foo"] : "" ?>', '@Html.Raw(Model.data["foo"])']) {
    const left = `<input value="${expression}a  b">`;
    const right = `<input value="${expression}a b">`;
    const inline = diffInlineWithAppendLiteral(left,right);
    const expected = [{ start: left.indexOf("a  b") + 2, end: left.indexOf("a  b") + 3 }];
    expect(inline.leftRanges).toEqual(expected);
    expect(extractHtmlAttributeSpaceDiffRangesPair(left,right,inline.leftRanges,inline.rightRanges).left).toEqual(expected);
  }
});

it("keeps report tab stops after wide and combining characters across highlight spans", () => {
  const html = buildDiffReportHtml([{leftText:"日\tX",rightText:"e\u0301\tX",leftInlineRanges:[{start:0,end:1}]}],{mode:"rich"});
  expect(html).toContain('日</span>&nbsp;&nbsp;X');
  expect(html).toContain('e\u0301&nbsp;&nbsp;&nbsp;X');
});

it.each(["ts", "wasm"] as const)("finds distant pairs and preserves anchor splits with %s", async (mode) => {
  const engine = await createDiffEngine({mode});
  const left = ['if ($wdata["flag"] != "1")', '// 入力チェック（詳細）', '<html>'];
  const right = [...Array.from({length:60}, (_,i) => `unrelated${i}();`),
    'if (wdata["flag"].b() != "1")', '// 入力チェック', '<html lang="ja">'];
  const ops = pairReplace(engine.diffLines(left.join("\n"),right.join("\n")));
  expect(ops.filter((op) => op.type === "replace").map((op) => [op.leftLineNo,op.rightLineNo])).toEqual([[0,60],[1,61],[2,62]]);
  expect(engine.diffWithAnchors(left.join("\n"),right.join("\n"),[{leftLineNo:2,rightLineNo:62}]).filter((op) => op.type === "replace")).toHaveLength(3);
});

it("does not promote middle-only comment overlap or empty comment markers", async () => {
  const engine = await createDiffEngine({mode:"ts"});
  for (const [left,right] of [['// XXX YYY','// YYY'], ['//','// anything'], ['// !!!','// !!! extra']]) {
    // Check the dedicated prefix rule: these lines have no matching leading body.
    expect(pairReplace(engine.diffLines(left,right)).some((op) => op.type === "replace")).toBe(false);
  }
});
