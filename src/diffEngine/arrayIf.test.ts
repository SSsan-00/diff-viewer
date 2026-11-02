import { afterEach, expect, it } from "vitest";
import { extractArrayIfSignature } from "./arrayIf";
import { createDiffEngine } from "./engine";
import { pairReplace } from "./pairReplace";
import { diffInlineWithAppendLiteral, setDiffInlineCore, setDiffInlineBatchCore } from "./diffInline";
import { prepareReplaceOpsForDisplay } from "./replaceVisibility";

const php = `if($wdata['cfutan_flg'] != "1" && $wdata['cfutan_flg'] != 1) $wdata['cfutan_flg'] = 0;`;
const converted = 'if (wdata["cfutan_flg"].s() != "1" && wdata["cfutan_flg"].i() != 1) wdata["cfutan_flg"] = 0;';
const signature = (line: string) => extractArrayIfSignature(line)?.key;
afterEach(() => { setDiffInlineCore(null); setDiffInlineBatchCore(null); });

it.each(["s", "i", "m", "b"])("pairs same-line assignments with %s conversion and nested conditions", (method) => {
  const left = `\tif (($a['x'] == ")||(" || $b['y'] >= 1) && $a['z'] != 2) $a['x'] = "ok)";`;
  const right = ` if ((a["x"].${method}() == ")||(" || b["y"].i() >= 1) && a["z"].m() != 2) a["x"] = 'ok)';`;
  expect(signature(left)).toBeDefined();
  expect(signature(left)).toBe(signature(right));
});

it.each([
  converted.replace(' = 0;', ' = 1;'),
  converted.replace(' = 0;', ' = "0";'),
  converted.replace(') wdata["cfutan_flg"] =', ') other["cfutan_flg"] ='),
  converted.replace(') wdata["cfutan_flg"] =', ') wdata["other"] ='),
  converted.replace('&&', '||'),
])("does not use a different condition or assignment as the same signature: %s", (line) => {
  expect(signature(php)).toBeDefined();
  expect(signature(php)).not.toBe(signature(line));
});

it.each([
  converted + ' other = 1;',
  converted + ' // note',
  converted.replace(' = 0;', ' += 0;'),
  converted.replace(' = 0;', ' = func();'),
  converted.replace(' = 0;', ' = 0'),
  converted.replace(') wdata', ' wdata'),
  converted.replace(') wdata', ') $wdata'),
  converted.replace(') wdata["cfutan_flg"]', ') wdata[key]'),
  converted.replace('.s()', '.s(value)'),
  converted.replace('.s()', '.unknown()'),
  converted.replace(') wdata', ') { wdata') + ' }',
])("rejects unsupported or incomplete statements: %s", (line) => {
  expect(extractArrayIfSignature(line)).toBeNull();
});

it.each(["ts", "wasm"] as const)("aligns the supplied case with %s, including distant and anchor-split rows", async (mode) => {
  const engine = await createDiffEngine({mode});
  for (const [left,right] of [[php,converted],[converted,php]]) {
    const ops = pairReplace(engine.diffLines(left,right));
    expect(ops.map((op) => op.type)).toEqual(["replace"]);
    expect(prepareReplaceOpsForDisplay(ops,{ignoreLeadingFileWhitespace:false}).ops).toEqual(ops);
    const inline = diffInlineWithAppendLiteral(left,right);
    expect(inline.leftRanges.length + inline.rightRanges.length).toBeGreaterThan(0);
    for (const [line,ranges] of [[left,inline.leftRanges],[right,inline.rightRanges]] as const) {
      for (const range of ranges) {
        expect(range.start).toBeGreaterThanOrEqual(0);
        expect(range.end).toBeLessThanOrEqual(line.length);
        expect(line.slice(range.start,range.end)).not.toContain(' = 0;');
      }
    }
    const shifted = [...Array.from({length:60},(_,i) => `unrelated${i}();`),right,'done();'].join('\n');
    expect(pairReplace(engine.diffLines(left+'\ndone();',shifted)).find((op) => op.type === 'replace')).toMatchObject({leftLineNo:0,rightLineNo:60});
    expect(engine.diffWithAnchors(left+'\ndone();',shifted,[{leftLineNo:1,rightLineNo:61}])[60]).toMatchObject({type:'replace',leftLineNo:0,rightLineNo:60});
  }
});
