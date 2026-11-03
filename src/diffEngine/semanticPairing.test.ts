import { prepareReplaceOpsForDisplay } from "./replaceVisibility";
import { afterEach, expect, it } from "vitest";
import { createDiffEngine } from "./engine";
import { pairReplace } from "./pairReplace";
import { extractControlStatementSignature } from "./controlStatement";
import { diffInlineWithAppendLiteral, diffInlineWithAppendLiteralBatch, setDiffInlineCore, setDiffInlineBatchCore } from "./diffInline";
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
  const key = (condition: string) => extractControlStatementSignature(`if (${condition})`);
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

it.each(["ts", "wasm"] as const)("pairs converted control statements and preserves their raw highlights with %s", async (mode) => {
  const engine = await createDiffEngine({mode});
  expect(engine.getStatus().activeMode).toBe(mode);
  const pairs = [
    ['<? for($i = 1; $I <= 10; $I++) { ?>', '@for(int i = 1; I <= 10; I++)'],
    [`switch($data['foo'])`, 'switch(data["foo"].s())'],
    [`if($data['foo'] != $data['bar']) $data['hoge'] = "1";`, 'if(data["foo"].s() != data["bar"].s()) data["hoge"] = "1";'],
    [`if($data['foo' . $i] != "")`, 'if(data["foo" + i].s() != "")'],
    [`for($I = 0; $I < $data['cnt']; $I++)`, 'for(int I = 0; I < data["cnt"].i(); I++)'],
  ];
  for (const reverse of [false,true]) {
    const left = pairs.map((p) => p[reverse ? 1 : 0]);
    const right = pairs.map((p) => p[reverse ? 0 : 1]);
    const shifted = [...Array.from({length:60},(_,i) => `unrelated${i}();`),...right,'done();'];
    const ops = pairReplace(engine.diffLines([...left,'done();'].join('\n'),shifted.join('\n')));
    expect(ops.filter((op) => op.type === 'replace').map((op) => [op.leftLineNo,op.rightLineNo])).toEqual(left.map((_,i) => [i,i+60]));
    expect(engine.diffWithAnchors([...left,'done();'].join('\n'),shifted.join('\n'),[{leftLineNo:5,rightLineNo:65}]).filter((op) => op.type === 'replace')).toHaveLength(5);
    const inputs = left.map((leftLine,i) => ({leftLine,rightLine:right[i]}));
    expect(diffInlineWithAppendLiteralBatch(inputs)).toEqual(inputs.map((p) => diffInlineWithAppendLiteral(p.leftLine,p.rightLine)));
  }
  const indented = prepareReplaceOpsForDisplay([{type:'equal',leftLine:'    sb.AppendLine("abc");',rightLine:'sb.AppendLine("abc");',leftLineNo:0,rightLineNo:0}],{ignoreLeadingFileWhitespace:true});
  expect(indented.ops[0].type).toBe('equal');
  expect(indented.displayDiffs[0]?.inline).toEqual({leftRanges:[],rightRanges:[]});
  const l='sb.AppendLine($@"{Get("}")} tail old");', r='sb.AppendLine($@"{Get("}")} tail new");';
  expect(diffInlineWithAppendLiteral(l,r)).toEqual({leftRanges:[{start:l.indexOf('old'),end:l.indexOf('old')+3}],rightRanges:[{start:r.indexOf('new'),end:r.indexOf('new')+3}]});
  const a='sb.AppendLine(@"<input name=""foo"" value=""a  b > c"">");', b='sb.AppendLine(@"<input name=""foo"" value=""a b > c"">");';
  const inline=diffInlineWithAppendLiteral(a,b);
  expect(extractHtmlAttributeSpaceDiffRangesPair(a,b,inline.leftRanges,inline.rightRanges)).toEqual({left:[{start:a.indexOf('a  b')+2,end:a.indexOf('a  b')+3}],right:[]});
});

it("keeps control operands, loop updates and dynamic keys distinct", () => {
  const key = (line: string) => extractControlStatementSignature(line)?.key;
  const base='for(int I = 0; I < data["cnt"].i(); I++)';
  for(const other of [base.replace('0','1'),base.replace('<','<='),base.replace('cnt','other'),base.replace('I++','I--'),base.replace('int I','int i')]) expect(key(other)).not.toBe(key(base));
  expect(key('if(data["foo" + i].s() != "")')).not.toBe(key('if(data["foo" + j].s() != "")'));
  expect(key('switch(data["foo"].s())')).not.toBe(key('switch(data["bar"].s())'));
  for(const invalid of [base.replace('.i()','.I()'),base.replace('.i()','.i(1)'), 'if(data["foo" + i + j].s() != "")', 'switch(data["foo"].s()) trailing()', '<? for($i = 0; $i < 10; $i++) {']) expect(key(invalid)).toBeUndefined();
});
