import { prepareReplaceOpsForDisplay } from "./replaceVisibility";
import { afterEach, expect, it } from "vitest";
import { createDiffEngine } from "./engine";
import { pairReplace } from "./pairReplace";
import { extractControlStatementSignature } from "./controlStatement";
import { diffInlineWithAppendLiteral, diffInlineWithAppendLiteralBatch, setDiffInlineCore, setDiffInlineBatchCore } from "./diffInline";
import { extractHtmlAttributeSpaceDiffRangesPair } from "./htmlAttributeSpaceDiff";
import { buildReportRowsFromVisualRows, buildDiffReportHtml } from "../ui/diffReport";

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

it.each(["ts", "wasm"] as const)("pairs converted multiplication, nullable conditions and trailing text with %s", async (mode) => {
  const engine = await createDiffEngine({mode});
  expect(engine.getStatus().activeMode).toBe(mode);
  const pairs = [
    [`$data['foo'] *= -1;`, 'MathUtil.Multiply(ref data.Ref("foo"), -1);'],
    [`if((isset($data['foo']) ? $data['foo'] : "") == "1")`, 'if(($data["foo"].s()) == "1")'],
    [`<? if($data['foo'] != ""){ ?>`, '@if(Model.data["foo"].s() != "")'],
    ['Xxxx Yyyy', 'Xxxx'],
    ['DoWork(); // 日本語🙂の注釈', 'DoWork();'],
    ['DoWork(); /* annotation */', 'DoWork();'],
    [`if((isset($a['x']) ? $a['x'] : "") == "1") // 日本語🙂`, 'if((a["x"].s()) == "1")'],
    ['Xxxx '+Array.from({length:40},(_,i) => `word${i}`).join(' '), 'Xxxx'],
  ];
  for (const [left,right] of [...pairs.slice(0,3),pairs[6]]) {
    expect(extractControlStatementSignature(left)?.key).toBeDefined();
    expect(extractControlStatementSignature(left)?.key).toBe(extractControlStatementSignature(right)?.key);
  }
  for (const reverse of [false,true]) {
    const left = pairs.map((pair) => pair[reverse ? 1 : 0]);
    const right = pairs.map((pair) => pair[reverse ? 0 : 1]);
    const shifted = [...Array.from({length:60},(_,i) => `unrelated${i}();`),...right,'done();'];
    const ops = pairReplace(engine.diffLines([...left,'done();'].join('\n'),shifted.join('\n')));
    expect(ops.filter((op) => op.type === 'replace').map((op) => [op.leftLineNo,op.rightLineNo])).toEqual(left.map((_,i) => [i,i+60]));
    expect(engine.diffWithAnchors([...left,'done();'].join('\n'),shifted.join('\n'),[{leftLineNo:left.length,rightLineNo:right.length+60}]).filter((op) => op.type === 'replace')).toHaveLength(pairs.length);
    const inputs = left.map((leftLine,i) => ({leftLine,rightLine:right[i]}));
    const inline = diffInlineWithAppendLiteralBatch(inputs);
    expect(inline).toEqual(inputs.map((p) => diffInlineWithAppendLiteral(p.leftLine,p.rightLine)));
    const display = prepareReplaceOpsForDisplay(ops,{ignoreLeadingFileWhitespace:false});
    expect(display.displayDiffs.filter((_,i) => display.ops[i].type === 'replace').map((d) => d?.inline)).toEqual(inline);
    for (let i=0;i<pairs.length;i++) {
      const report = buildReportRowsFromVisualRows([{kind:'replace',leftText:left[i],rightText:right[i]}])[0];
      expect(report.leftInlineRanges).toEqual(inline[i].leftRanges);
      expect(report.rightInlineRanges).toEqual(inline[i].rightRanges);
      for (const [line,ranges] of [[left[i],inline[i].leftRanges],[right[i],inline[i].rightRanges]] as const) {
        for (const range of ranges) {
          expect(range.start).toBeGreaterThanOrEqual(0);
          expect(range.end).toBeGreaterThan(range.start);
          expect(range.end).toBeLessThanOrEqual(line.length);
        }
        if (i<3 || i===6) {
          const key = i===6 ? 'x' : 'foo';
          const start = line.lastIndexOf(key);
          expect(ranges.some((r) => r.start<start+key.length && r.end>start)).toBe(false);
        }
        if (i<3) {
          const start = line.lastIndexOf('data');
          expect(ranges.some((r) => r.start<start+4 && r.end>start)).toBe(false);
        }
      }
      if (i>=3 && i!==6) {
        const suffix = {start:right[i].length,end:left[i].length};
        expect(inline[i]).toEqual(reverse
          ? {leftRanges:[],rightRanges:[{start:left[i].length,end:right[i].length}]}
          : {leftRanges:[suffix],rightRanges:[]});
      }
    }
  }
});

it("keeps nullable references and multiplication targets distinct", () => {
  const key = (line: string) => extractControlStatementSignature(line)?.key;
  const left = `$data['foo'] *= -1;`;
  const right = 'MathUtil.Multiply(ref data.Ref("foo"), -1);';
  expect(key(left)).toBeDefined();
  for (const other of [right.replace('data.Ref','other.Ref'),right.replace('foo','bar'),right.replace('-1','1')]) expect(key(other)).not.toBe(key(left));
  for (const invalid of [right.replace('ref ',''),right.replace('Ref','Other'),right.replace('-1','"-1"'),right+' extra();',`if((isset($data['foo']) ? $data['bar'] : "") == "1")`,`if((isset($data['foo']) ? $data['foo'] : "0") == "1")`,'if(/* comment */ data["foo"].s() == "1")']) expect(key(invalid)).toBeUndefined();
  const nullable = `if((isset($data['foo']) ? $data['foo'] : "") == "1")`;
  for (const method of ['s','i','m','b']) expect(key(nullable)).toBe(key(`if((Model.data["foo"].${method}()) == "1") /* note */`));
  for (const [a,b] of [['XxxxYyyy','Xxxx'],['!!! note','!!!']]) {
    expect(pairReplace([{type:'delete',leftLine:a,leftLineNo:0},{type:'insert',rightLine:b,rightLineNo:0}]).some((op) => op.type === 'replace')).toBe(false);
  }
});

it.each(["ts", "wasm"] as const)("keeps body highlights and source coordinates stable across indentation and blank rows with %s", async (mode) => {
  const engine = await createDiffEngine({mode});
  expect(engine.getStatus().activeMode).toBe(mode);
  const pairs = [
    [`$data['foo'] *= -1;`, 'MathUtil.Multiply(ref data.Ref("foo"), -1);'],
    ['<input name="foo" class="bar" value="old">','<input name="foo" class="bar" value="new">'],
    ['sb.AppendLine("same old");','sb.AppendLine("same new");'],
  ];
  for (const [left,right] of pairs) for (const ignoreLeadingFileWhitespace of [false,true]) {
    const options = {ignoreLeadingFileWhitespace};
    const base = diffInlineWithAppendLiteral(left,right,options);
    for (const [a,b] of [[' ',''],['\t\t','  '],['',' \t']]) {
      const leftLine = a+left, rightLine = b+right;
      const inline = diffInlineWithAppendLiteral(leftLine,rightLine,options);
      const bodyRanges = (ranges: Array<{start:number;end:number}>, prefix: string) => ranges
        .filter((r) => r.end>prefix.length)
        .map((r) => ({start:Math.max(0,r.start-prefix.length),end:r.end-prefix.length}));
      expect(bodyRanges(inline.leftRanges,a)).toEqual(base.leftRanges);
      expect(bodyRanges(inline.rightRanges,b)).toEqual(base.rightRanges);
      for (const [prefix,ranges] of [[a,inline.leftRanges],[b,inline.rightRanges]] as const) {
        for (let i=0;i<prefix.length;i++) {
          expect(ranges.some((r) => r.start<=i&&r.end>i)).toBe(!ignoreLeadingFileWhitespace);
        }
      }
      const leftLines = ['', '\t', leftLine, 'done();'];
      const rightLines = ['  ', '', '', rightLine, 'done();'];
      for (const anchored of [false,true]) {
        const ops = anchored
          ? engine.diffWithAnchors(leftLines.join('\n'),rightLines.join('\r\n'),[{leftLineNo:3,rightLineNo:4}],options)
          : pairReplace(engine.diffLines(leftLines.join('\n'),rightLines.join('\r\n'),options));
        const prepared = prepareReplaceOpsForDisplay(ops,options);
        const index = prepared.ops.findIndex((op) => op.leftLineNo===2&&op.rightLineNo===3);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(prepared.ops[index]).toMatchObject({type:'replace',leftLine,rightLine});
        expect(prepared.displayDiffs[index]?.inline).toEqual(inline);
        const report = buildReportRowsFromVisualRows(prepared.ops.map((op) => ({kind:op.type,leftText:op.leftLine??'',rightText:op.rightLine??''})),options)[index];
        expect(report.leftInlineRanges).toEqual(inline.leftRanges);
        expect(report.rightInlineRanges).toEqual(inline.rightRanges);
      }
    }
  }
  const line = 'sb.AppendLine("same");';
  expect(diffInlineWithAppendLiteral('\t\t'+line,'  '+line)).toEqual({leftRanges:[{start:0,end:2}],rightRanges:[{start:0,end:2}]});
});

it.each(["ts", "wasm"] as const)("compares input values within their own attributes with %s", async (mode) => {
  const engine = await createDiffEngine({mode});
  expect(engine.getStatus().activeMode).toBe(mode);
  const value='0123456789012345678901234567890123456789';
  const left=`<input value="${value}" name="foo" class="bar" data-x="x">`;
  const right=`<input value="x" name="foo" class="bar" data-x="${value}">`;
  const ranges = (line: string) => ['value','data-x'].map((name) => {
    const start=line.indexOf(` ${name}="`)+name.length+3;
    return {start,end:line.indexOf('"',start)};
  });
  const expected={leftRanges:ranges(left),rightRanges:ranges(right)};
  expect(diffInlineWithAppendLiteral(left,right)).toEqual(expected);
  expect(diffInlineWithAppendLiteralBatch([{leftLine:left,rightLine:right}])).toEqual([expected]);
  const prepared=prepareReplaceOpsForDisplay(pairReplace(engine.diffLines(left,right)),{ignoreLeadingFileWhitespace:false});
  expect(prepared.ops.map((op)=>op.type)).toEqual(['replace']);
  expect(prepared.displayDiffs[0]?.inline).toEqual(expected);
  const report=buildReportRowsFromVisualRows([{kind:'replace',leftText:left,rightText:right}])[0];
  expect(report.leftInlineRanges).toEqual(expected.leftRanges);
  expect(report.rightInlineRanges).toEqual(expected.rightRanges);
  for(const [a,b] of [
    [`<input name='a' class='b'>`, '<input name="a" class="b">'],
    ['<input name="a" class="b">','<input name="c" class="d">'],
    ['  <input name="日本🙂" class="a" value="old">','<input name="日本🙂" class="a" value="new">'],
    [`<input name="foo" value="<?= $data['old'] ?>">`, '<input name="foo" value="@Html.Raw(Model.data["new"])">'],
  ]) {
    const inline=diffInlineWithAppendLiteral(a,b,{ignoreLeadingFileWhitespace:true});
    expect(diffInlineWithAppendLiteralBatch([{leftLine:a,rightLine:b,options:{ignoreLeadingFileWhitespace:true}}])).toEqual([inline]);
    expect(inline.leftRanges.length+inline.rightRanges.length).toBeGreaterThan(0);
    if(a.includes("name='a'")) {
      expect(inline.leftRanges.map((r)=>a.slice(r.start,r.end))).toEqual(["'","'","'","'"]);
    } else if(b.includes('name="c"')) {
      expect(inline.leftRanges.map((r)=>a.slice(r.start,r.end))).toEqual(['a','b']);
      expect(inline.rightRanges.map((r)=>b.slice(r.start,r.end))).toEqual(['c','d']);
    } else {
      for(const [line,rs] of [[a,inline.leftRanges],[b,inline.rightRanges]] as const) {
        const start=line.indexOf(' name="')+7, end=line.indexOf('"',start);
        expect(rs.some((r)=>r.start<end&&r.end>start)).toBe(false);
      }
    }
  }
});
