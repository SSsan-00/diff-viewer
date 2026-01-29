import { describe, it, expect } from "vitest";
import { diffLinesFromLines } from "./diffLines";
import { diffInline } from "./diffInline";
import { toAppendLiteralOrLine } from "./appendLiteral";
import { pairReplace } from "./pairReplace";
import { diffWithAnchors, type Anchor } from "./anchors";
import type { PairedOp } from "./types";

function toPairedOps(left: string[], right: string[]): PairedOp[] {
  return pairReplace(diffLinesFromLines(left, right));
}

function findReplace(ops: PairedOp[], left: string, right: string): boolean {
  return ops.some(
    (op) =>
      op.type === "replace" &&
      (op.leftLine ?? "").includes(left) &&
      (op.rightLine ?? "").includes(right),
  );
}

function findEqual(ops: PairedOp[], left: string, right: string): boolean {
  return ops.some(
    (op) =>
      op.type === "equal" &&
      (op.leftLine ?? "").includes(left) &&
      (op.rightLine ?? "").includes(right),
  );
}

function findInsert(ops: PairedOp[], right: string): boolean {
  return ops.some(
    (op) => op.type === "insert" && (op.rightLine ?? "").includes(right),
  );
}

function findDelete(ops: PairedOp[], left: string): boolean {
  return ops.some(
    (op) => op.type === "delete" && (op.leftLine ?? "").includes(left),
  );
}

function findBlankDelete(ops: PairedOp[]): boolean {
  return ops.some((op) => op.type === "delete" && (op.leftLine ?? "").trim() === "");
}

function findBlankInsert(ops: PairedOp[]): boolean {
  return ops.some((op) => op.type === "insert" && (op.rightLine ?? "").trim() === "");
}

describe("semantic alignment across languages", () => {
  it("aligns indent-only changes without breaking alignment", () => {
    const left = ["    var foo = 1;"];
    const right = ["var foo = 1;"];

    const ops = toPairedOps(left, right);
    expect(findEqual(ops, "var foo", "var foo")).toBe(false);
    expect(findReplace(ops, "var foo", "var foo")).toBe(true);
  });

  it("aligns indent-only comment lines with multibyte text", () => {
    const left = ["// ここはコメント行"];
    const right = ["        // ここはコメント行"];

    const ops = toPairedOps(left, right);
    expect(findEqual(ops, "ここはコメント行", "ここはコメント行")).toBe(false);
    expect(findReplace(ops, "ここはコメント行", "ここはコメント行")).toBe(true);
  });

  it("aligns indent-only keyword lines", () => {
    const left = ["break;", "else", "{"];
    const right = ["        break;", "        else", "        {"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "break", "break")).toBe(true);
    expect(findReplace(ops, "else", "else")).toBe(true);
    expect(findReplace(ops, "{", "{")).toBe(true);
  });

  it("aligns else-only line against } else {", () => {
    const left = ["} else {"];
    const right = ["}", "else", "{"]; 

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "} else {", "else")).toBe(true);
    expect(findInsert(ops, "}")).toBe(true);
    expect(findInsert(ops, "{")).toBe(true);
    expect(findEqual(ops, "} else {", "else")).toBe(false);
  });

  it("does not treat elsewhere identifiers as else lines", () => {
    const left = ["elsewhere = 1;"];
    const right = ["else = 1;"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "elsewhere", "else")).toBe(false);
  });

  it("aligns variable lines with different syntax", () => {
    const left = ["$foo = 1;", "$bar = 2;"];
    const right = ["var foo = 1;", "var bar = 2;"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "$foo", "var foo")).toBe(true);
  });

  it("aligns function declarations with different return types", () => {
    const left = ["function test() {", "return 1;", "}"];
    const right = ["string test() {", "return 1;", "}"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "function test", "string test")).toBe(true);
  });

  it("allows argument notation differences when function name matches", () => {
    const left = ["function test($x) {", "return $x;", "}"];
    const right = ["string test(int x) {", "return x;", "}"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "function test", "string test")).toBe(true);
  });

  it("aligns constant definitions across languages", () => {
    const left = ["define('FOO','foo');"];
    const right = ["public readonly string FOO = 'foo';"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "define('FOO'", "FOO = 'foo'")).toBe(true);
  });

  it("keeps alignment when a blank line exists only on the left", () => {
    const left = ["$foo = $list['foo'];", ""];
    const right = ["HashMap foo = list[\"foo\"];"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "$foo = $list['foo'];", "HashMap foo = list[\"foo\"];")).toBe(
      true,
    );
    expect(findBlankDelete(ops)).toBe(true);
  });

  it("keeps alignment when a blank line exists only on the right", () => {
    const left = ["$foo = $list['foo'];"];
    const right = ["", "HashMap foo = list[\"foo\"];"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "$foo = $list['foo'];", "HashMap foo = list[\"foo\"];")).toBe(
      true,
    );
    expect(findBlankInsert(ops)).toBe(true);
  });

  it("treats whitespace-only lines as blanks without breaking matches", () => {
    const left = ["$foo = $list['foo'];", "   "];
    const right = ["HashMap foo = list[\"foo\"];"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "$foo = $list['foo'];", "HashMap foo = list[\"foo\"];")).toBe(
      true,
    );
    expect(findBlankDelete(ops)).toBe(true);
  });

  it("aligns line comments with xml doc comments", () => {
    const left = ["// comment"];
    const right = ["/// <summary>comment</summary>"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "// comment", "<summary>comment</summary>")).toBe(true);
  });

  it("aligns SQL concatenation with large blank gaps", () => {
    const left = [
      "$sql = \"select name\";",
      "$sql .= \",  age\";",
      "$sql .= \" from          users\";",
    ];
    const right = [
      "sql = \"select name\";",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "sql += \", age\";",
      "sql += \" from users\";",
    ];

    const ops = toPairedOps(left, right);
    // eslint-disable-next-line no-console
    expect(findReplace(ops, "$sql .= \",  age\";", "sql += \", age\";")).toBe(true);
    expect(findReplace(ops, "$sql .= \" from          users\";", "sql += \" from users\";")).toBe(true);
    expect(findBlankInsert(ops)).toBe(true);
  });

  it("aligns Razor @: prefixed return lines", () => {
    const left = ["console.log('foo');", "return;"];
    const right = ["@:console.log('foo');", "@:return;"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "console.log('foo');", "@:console.log('foo');")).toBe(true);
    expect(findReplace(ops, "return;", "@:return;")).toBe(true);
  });

  it("does not strip non @: Razor constructs", () => {
    const left = ["return;"];
    const right = ["@{ var x = 1; }"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "return;", "@{ var x = 1; }")).toBe(false);
  });

  it("aligns property references to variable declarations", () => {
    const left = ["this.foo = 1;"];
    const right = ["$foo = 1;"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "this.foo", "$foo")).toBe(true);
  });

  it("aligns function calls with argument notation differences", () => {
    const left = ["test($x);"];
    const right = ["test(x);"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "test($x)", "test(x)")).toBe(true);
  });

  it("aligns SQL construction across languages", () => {
    const left = [
      "StringBuilder sql = new();",
      "sql.AppendLine(\"select * from users\");",
      "sql.AppendLine(\"where name = 'taro'\");",
    ];
    const right = [
      "$sql = \"\";",
      "$sql .= \"select * from users\";",
      "$sql .= \"where name = 'taro'\";",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "StringBuilder sql", "$sql = \"\"")).toBe(true);
    expect(findReplace(ops, "select * from users", "select * from users")).toBe(true);
    expect(findReplace(ops, "where name = 'taro'", "where name = 'taro'")).toBe(true);
  });

  it("aligns SQL builder initialization with var keyword", () => {
    const left = ["var sql = new StringBuilder();"];
    const right = ["$sql = \"\";"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "var sql", "$sql = \"\"")).toBe(true);
  });

  it("aligns SQL date formatting across languages", () => {
    const left = ["$sql .= \", to_char(date, 'yyyy/mm/dd')\";"];
    const right = ["sql += \", FORMAT(date, 'yyyy/MM/dd')\";"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "to_char", "FORMAT")).toBe(true);
    expect(findEqual(ops, "to_char", "FORMAT")).toBe(false);
  });

  it("does not align date formatting when arguments differ", () => {
    const left = ["$sql .= \", to_char(date, 'yyyy/mm/dd')\";"];
    const right = ["sql += \", FORMAT(other, 'yyyy/MM/dd')\";"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "to_char", "FORMAT")).toBe(false);
  });

  it("aligns function declarations with modifiers when names match", () => {
    const left = ["public static string test() {", "return 1;", "}"];
    const right = ["function test() {", "return 1;", "}"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "string test", "function test")).toBe(true);
  });

  it("aligns brace-only lines with different indentation", () => {
    const left = [
      "        function sumList(values) {",
      "          return values.reduce((total, value) => total + value, 0);",
      "        }",
    ];
    const right = [
      "function sumList(values) {",
      "  return values.reduce((total, value) => total + value, 0);",
      "}",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "function sumList", "function sumList")).toBe(true);
    expect(findReplace(ops, "return values.reduce", "return values.reduce")).toBe(true);
    expect(findReplace(ops, "}", "}")).toBe(true);
    expect(findEqual(ops, "}", "}")).toBe(false);
  });

  it("aligns php tag wrapped braces as replace pairs", () => {
    const left = ["{", "}"];
    const right = ["<? { ?>", "  <? } ?>"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "{", "<? {")).toBe(true);
    expect(findReplace(ops, "}", "<? }")).toBe(true);
    expect(findEqual(ops, "{", "<? {")).toBe(false);
    expect(findEqual(ops, "}", "<? }")).toBe(false);
  });

  it("aligns SQL construction across languages", () => {
    const left = ["builder.AppendLine(\"select * from users\");"];
    const right = ["$sql .= \"select * from users\";"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "AppendLine", "$sql")).toBe(true);
  });

  it("aligns css lines built via string appends", () => {
    const left = [
      "body {",
      "  color: red;",
      "}",
    ];
    const right = [
      "css.AppendLine(\"body {\");",
      "css.AppendLine(\"  color: red;\");",
      "css.AppendLine(\"}\");",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "body {", "body {")).toBe(true);
    expect(findReplace(ops, "color: red", "color: red")).toBe(true);
    expect(findReplace(ops, "}", "}\"")).toBe(true);
    expect(findEqual(ops, "body {", "body {")).toBe(false);
  });

  it("aligns js blocks built via string appends", () => {
    const left = [
      "function test() {",
      "  console.log('test');",
      "}",
    ];
    const right = [
      "js.AppendLine(\"function test() {\");",
      "js.AppendLine(\"  console.log('test');\");",
      "js.AppendLine(\"}\");",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "function test()", "function test()")).toBe(true);
    expect(findReplace(ops, "console.log('test')", "console.log('test')")).toBe(true);
    expect(findReplace(ops, "}", "}\"")).toBe(true);
    expect(findEqual(ops, "function test()", "function test()")).toBe(false);
  });

  it("aligns js lines even with escaped quotes in string builders", () => {
    const left = [
      "function test() {",
      "  console.log('test');",
      "}",
    ];
    const right = [
      "js.AppendLine(\"function test() {\");",
      "js.AppendLine(\"  console.log(\\\"test\\\");\");",
      "js.AppendLine(\"}\");",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "function test()", "function test()")).toBe(true);
    expect(findReplace(ops, "console.log", "console.log")).toBe(true);
    expect(findReplace(ops, "}", "}\"")).toBe(true);
  });

  it("aligns indented word lines against appendline strings", () => {
    const left = ["            FOO"];
    const right = ["sb.AppendLine(\"     FOO\");"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "FOO", "FOO")).toBe(true);
    expect(findEqual(ops, "FOO", "FOO")).toBe(false);
    const inline = diffInline(left[0], right[0]);
    expect(inline.leftRanges.length + inline.rightRanges.length).toBeGreaterThan(0);
  });

  it("aligns php option lines against interpolated string builders", () => {
    const left = [
      `<option value="<?= $foo ?>" <?= ($foo == "foo" ? " selected" : "") ?>>$bar</option>`,
    ];
    const right = [
      "sb.AppendLine(\"<option value=\\\"{foo}\\\"{(foo == \"foo\" ? \" selected\" : \"\")}>{bar}</option>\");",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "<option", "<option")).toBe(true);
    expect(findEqual(ops, "<option", "<option")).toBe(false);
    const inline = diffInline(left[0], right[0]);
    expect(inline.leftRanges.length + inline.rightRanges.length).toBeGreaterThan(0);
  });

  it("aligns js lines with backslash and yen variants", () => {
    const left = [
      "console.log(\"C:\\\\temp\\\\a.txt\");",
    ];
    const right = [
      "js.AppendLine(\"console.log(\\\"C:¥temp¥a.txt\\\");\");",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "C:\\\\temp\\\\a.txt", "C:¥temp¥a.txt")).toBe(true);
  });

  it("treats .php suffix differences as replace pairs", () => {
    const left = [
      "document.excel.action = \"foo_bar.php\";",
    ];
    const right = [
      "document.excel.action = \"foo_bar\";",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "foo_bar.php", "foo_bar")).toBe(true);
    expect(findEqual(ops, "foo_bar.php", "foo_bar")).toBe(false);
  });

  it("aligns html lines built via string appends", () => {
    const left = [
      "<div class=\"box\">",
      "  <span>hello</span>",
      "</div>",
    ];
    const right = [
      "html.AppendLine(\"<div class=\\\"box\\\">\");",
      "html.AppendLine(\"  <span>hello</span>\");",
      "html.AppendLine(\"</div>\");",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "<div class", "<div class")).toBe(true);
    expect(findReplace(ops, "<span>hello</span>", "<span>hello</span>")).toBe(true);
    expect(findReplace(ops, "</div>", "</div>")).toBe(true);
    expect(findEqual(ops, "<div class", "<div class")).toBe(false);
  });

  it("aligns embedded script lines inside html blocks", () => {
    const left = [
      "<div class=\"box\">",
      "  <script>",
      "    console.log(\"x\");",
      "  </script>",
      "</div>",
    ];
    const right = [
      "s.AppendLine(\"<div class=\\\"box\\\">\");",
      "s.AppendLine(\"  <script>\");",
      "s.AppendLine(\"    console.log(\\\"x\\\");\");",
      "s.AppendLine(\"  </script>\");",
      "s.AppendLine(\"</div>\");",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "<div class", "<div class")).toBe(true);
    expect(findReplace(ops, "<script>", "<script>")).toBe(true);
    expect(findReplace(ops, "console.log", "console.log")).toBe(true);
    expect(findReplace(ops, "</script>", "</script>")).toBe(true);
    expect(findReplace(ops, "</div>", "</div>")).toBe(true);
    expect(findEqual(ops, "console.log", "console.log")).toBe(false);
  });

  it("aligns JS source lines with StringBuilder AppendLine wrappers", () => {
    const left = [
      "const foo = 'foo';",
      "console.log(foo);",
      "return;",
    ];
    const right = [
      "js.AppendLine(\"const foo = \\\"foo\\\";\");",
      "js.AppendLine(\"console.log(foo);\");",
      "js.AppendLine(\"return;\");",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "const foo = 'foo';", "const foo = \\\"foo\\\";")).toBe(true);
    expect(findReplace(ops, "console.log(foo);", "console.log(foo);")).toBe(true);
    expect(findReplace(ops, "return;", "return;")).toBe(true);
    const inline = diffInline(left[2], right[2]);
    expect(inline.leftRanges.length + inline.rightRanges.length).toBeGreaterThan(0);
  });

  it("aligns HTML lines against AppendLine outputs (5+ cases)", () => {
    const left = [
      "<div id=\"app\"></div>",
      "<option value=\"<?= $foo ?>\">$bar</option>",
      "<link rel=\"icon\" type=\"image/svg+xml\" href=\"data:image/svg+xml,...\">",
      "<script type=\"module\" src=\"/src/main.ts\"></script>",
      "</body>",
    ];
    const right = [
      "sb.AppendLine(\"<div id=\\\"app\\\"></div>\");",
      "sb.AppendLine($\"<option value=\\\"{foo}\\\">{bar}</option>\");",
      "sb.AppendLine(\"<link rel=\\\"icon\\\" type=\\\"image/svg+xml\\\" href=\\\"data:image/svg+xml,...\\\">\");",
      "sb.AppendLine(\"<script type=\\\"module\\\" src=\\\"/src/main.ts\\\"></script>\");",
      "sb.AppendLine(\"</body>\");",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "<div id", "<div id")).toBe(true);
    expect(findReplace(ops, "<option value", "<option value")).toBe(true);
    expect(findReplace(ops, "<link rel", "<link rel")).toBe(true);
    expect(findReplace(ops, "<script type", "<script type")).toBe(true);
    expect(findReplace(ops, "</body>", "</body>")).toBe(true);
    const inline = diffInline(left[0], right[0]);
    expect(inline.leftRanges.length + inline.rightRanges.length).toBeGreaterThan(0);
  });

  it("aligns CSS lines against AppendLine outputs (5+ cases)", () => {
    const left = [
      "body {",
      "  width: 100%;",
      "div#foo div#bar {",
      "  background-image: url(\"a.png\");",
      "}",
    ];
    const right = [
      "sb.AppendLine(\"body {\");",
      "sb.AppendLine(\"  width: 100%;\");",
      "sb.AppendLine(\"div#foo div#bar {\");",
      "sb.AppendLine(\"  background-image: url(\\\"a.png\\\");\");",
      "sb.AppendLine(\"}\");",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "body {", "body {")).toBe(true);
    expect(findReplace(ops, "width: 100%", "width: 100%")).toBe(true);
    expect(findReplace(ops, "div#foo div#bar {", "div#foo div#bar {")).toBe(true);
    expect(findReplace(ops, "background-image", "background-image")).toBe(true);
    expect(findReplace(ops, "}", "}")).toBe(true);
    const inline = diffInline(left[3], right[3]);
    expect(inline.leftRanges.length + inline.rightRanges.length).toBeGreaterThan(0);
  });

  it("aligns JS lines against AppendLine outputs (5+ cases)", () => {
    const left = [
      "const foo = 'foo';",
      "console.log(foo);",
      "return;",
      "fetch('/api');",
      "if (a) {",
    ];
    const right = [
      "js.AppendLine(\"const foo = \\\"foo\\\";\");",
      "js.AppendLine(\"console.log(foo);\");",
      "js.AppendLine(\"return;\");",
      "js.AppendLine(\"fetch(\\\"/api\\\");\");",
      "js.AppendLine(\"if (a) {\");",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "const foo", "const foo")).toBe(true);
    expect(findReplace(ops, "console.log", "console.log")).toBe(true);
    expect(findReplace(ops, "return;", "return;")).toBe(true);
    expect(findReplace(ops, "fetch", "fetch")).toBe(true);
    expect(findReplace(ops, "if (a)", "if (a)")).toBe(true);
    const inline = diffInline(left[0], right[0]);
    expect(inline.leftRanges.length + inline.rightRanges.length).toBeGreaterThan(0);
  });

  it("aligns HTML AppendLine outputs with escaped quotes (5+ cases)", () => {
    const left = [
      "<div class=\"name\">",
      "<input id=\"user\" name=\"user\" value=\"taro\">",
      "<span data-label=\"A\">",
      "<a href=\"/path\">",
      "</div>",
    ];
    const right = [
      "sb.AppendLine(\"<div class=\\\"name\\\">\");",
      "sb.AppendLine(\"<input id=\\\"user\\\" name=\\\"user\\\" value=\\\"taro\\\">\");",
      "sb.AppendLine(\"<span data-label=\\\"A\\\">\");",
      "sb.AppendLine(\"<a href=\\\"/path\\\">\");",
      "sb.AppendLine(\"</div>\");",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "<div class", "<div class")).toBe(true);
    expect(findReplace(ops, "<input id", "<input id")).toBe(true);
    expect(findReplace(ops, "<span data-label", "<span data-label")).toBe(true);
    expect(findReplace(ops, "<a href", "<a href")).toBe(true);
    expect(findReplace(ops, "</div>", "</div>")).toBe(true);
  });

  it("aligns CSS AppendLine outputs with quotes and comments (5+ cases)", () => {
    const left = [
      ".card {",
      "  font-family: \"Inter\";",
      "  content: \"hello\";",
      "  /* comment */",
      "}",
    ];
    const right = [
      "css.AppendLine(\".card {\");",
      "css.AppendLine(\"  font-family: \\\"Inter\\\";\");",
      "css.AppendLine(\"  content: \\\"hello\\\";\");",
      "css.AppendLine(\"  /* comment */\");",
      "css.AppendLine(\"}\");",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, ".card", ".card")).toBe(true);
    expect(findReplace(ops, "font-family", "font-family")).toBe(true);
    expect(findReplace(ops, "content", "content")).toBe(true);
    expect(findReplace(ops, "comment", "comment")).toBe(true);
    expect(findReplace(ops, "}", "}")).toBe(true);
  });

  it("aligns JS AppendLine outputs with comments and escaped quotes (5+ cases)", () => {
    const left = [
      "const foo = 1; // comment",
      "let bar = 2; /* note */",
      "const msg = \"hello\";",
      "switch (value) {",
      "case 1:",
      "default:",
    ];
    const right = [
      "js.AppendLine(\"const foo = 1; // comment\");",
      "js.AppendLine(\"let bar = 2; /* note */\");",
      "js.AppendLine(\"const msg = \\\"hello\\\";\");",
      "js.AppendLine(\"switch (value) {\");",
      "js.AppendLine(\"case 1:\");",
      "js.AppendLine(\"default:\");",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "const foo", "const foo")).toBe(true);
    expect(findReplace(ops, "let bar", "let bar")).toBe(true);
    expect(findReplace(ops, "const msg", "const msg")).toBe(true);
    expect(findReplace(ops, "switch", "switch")).toBe(true);
    expect(findReplace(ops, "case 1:", "case 1:")).toBe(true);
    expect(findReplace(ops, "default:", "default:")).toBe(true);
  });

  it("aligns Mini Sample HTML/CSS/JS lines against AppendLine outputs", () => {
    const left = [
      "<head>",
      "  <meta charset=\"utf-8\" />",
      "  <title>Mini Sample</title>",
      "  <style>",
      "    body {",
      "      font-family: sans-serif;",
      "    }",
      "    .box {",
      "      padding: 12px;",
      "      border: 1px solid #333;",
      "    }",
      "  </style>",
      "</head>",
      "<body>",
      "  <div class=\"box\" id=\"box\">",
      "    <button id=\"btn\">Click</button>",
      "    <p id=\"msg\">まだクリックされていません</p>",
      "  </div>",
      "",
      "  <script>",
      "    const btn = document.querySelector(\"#btn\");",
      "    const msg = document.querySelector(\"#msg\");",
      "",
      "    btn.addEventListener(\"click\", () => {",
      "      msg.textContent = \"クリックされた！\";",
      "    });",
      "  </script>",
      "</body>",
    ];

    const right = [
      "var sb = new StringBuilder();",
      "sb.AppendLine(\"<head>\");",
      "sb.AppendLine(\"  <meta charset=\\\"utf-8\\\" />\");",
      "sb.AppendLine(\"  <title>Mini Sample</title>\");",
      "sb.AppendLine(\"  <style>\");",
      "sb.AppendLine(\"    body {\");",
      "sb.AppendLine(\"      font-family: sans-serif;\");",
      "sb.AppendLine(\"    }\");",
      "sb.AppendLine(\"    .box {\");",
      "sb.AppendLine(\"      padding: 12px;\");",
      "sb.AppendLine(\"      border: 1px solid #333;\");",
      "sb.AppendLine(\"    }\");",
      "sb.AppendLine(\"  </style>\");",
      "sb.AppendLine(\"</head>\");",
      "sb.AppendLine(\"<body>\");",
      "sb.AppendLine(\"  <div class=\\\"box\\\" id=\\\"box\\\">\");",
      "sb.AppendLine(\"    <button id=\\\"btn\\\">Click</button>\");",
      "sb.AppendLine(\"    <p id=\\\"msg\\\">まだクリックされていません</p>\");",
      "sb.AppendLine(\"  </div>\");",
      "sb.AppendLine(\"\");",
      "sb.AppendLine(\"  <script>\");",
      "sb.AppendLine(\"    const btn = document.querySelector(\\\"#btn\\\");\");",
      "sb.AppendLine(\"    const msg = document.querySelector(\\\"#msg\\\");\");",
      "sb.AppendLine(\"\");",
      "sb.AppendLine(\"    btn.addEventListener(\\\"click\\\", () => {\");",
      "sb.AppendLine(\"      msg.textContent = \\\"クリックされた！\\\";\");",
      "sb.AppendLine(\"    });\");",
      "sb.AppendLine(\"  </script>\");",
      "sb.AppendLine(\"</body>\");",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "<head>", "AppendLine(\"<head>\"")).toBe(true);
    expect(findReplace(ops, "meta charset", "AppendLine(\"  <meta charset")).toBe(true);
    expect(findReplace(ops, "<title>Mini Sample</title>", "AppendLine(\"  <title>Mini Sample")).toBe(true);
    expect(findReplace(ops, "<style>", "AppendLine(\"  <style>\"")).toBe(true);
    expect(findReplace(ops, "body {", "AppendLine(\"    body {\"")).toBe(true);
    expect(findReplace(ops, "font-family", "AppendLine(\"      font-family")).toBe(true);
    expect(findReplace(ops, ".box {", "AppendLine(\"    .box {\"")).toBe(true);
    expect(findReplace(ops, "padding: 12px;", "AppendLine(\"      padding: 12px")).toBe(true);
    expect(findReplace(ops, "border: 1px solid #333;", "AppendLine(\"      border: 1px solid #333")).toBe(true);
    expect(findReplace(ops, "</style>", "AppendLine(\"  </style>\"")).toBe(true);
    expect(findReplace(ops, "</head>", "AppendLine(\"</head>\"")).toBe(true);
    expect(findReplace(ops, "<body>", "AppendLine(\"<body>\"")).toBe(true);
    expect(findReplace(ops, "<div class=\"box\" id=\"box\">", "AppendLine(\"  <div class")).toBe(true);
    expect(findReplace(ops, "<button id=\"btn\">Click</button>", "AppendLine(\"    <button id")).toBe(true);
    expect(findReplace(ops, "<p id=\"msg\">まだクリックされていません</p>", "AppendLine(\"    <p id")).toBe(true);
    expect(findReplace(ops, "const btn = document.querySelector", "AppendLine(\"    const btn")).toBe(true);
    expect(findReplace(ops, "const msg = document.querySelector", "AppendLine(\"    const msg")).toBe(true);
    expect(findReplace(ops, "btn.addEventListener", "AppendLine(\"    btn.addEventListener")).toBe(true);
    expect(findReplace(ops, "msg.textContent = \"クリックされた！\";", "AppendLine(\"      msg.textContent")).toBe(true);
    expect(findReplace(ops, "</script>", "AppendLine(\"  </script>\"")).toBe(true);
    expect(findReplace(ops, "</body>", "AppendLine(\"</body>\"")).toBe(true);
    expect(findInsert(ops, "StringBuilder")).toBe(true);

    const inline = diffInline(left[20], toAppendLiteralOrLine(right[21]));
    expect(inline.leftRanges.length + inline.rightRanges.length).toBe(0);
  });

  it("keeps AppendLine prefix inserts before the Mini Sample body alignment", () => {
    const left = [
      "<head>",
      "  <meta charset=\"utf-8\" />",
      "  <title>Mini Sample</title>",
      "  <style>",
      "    body {",
      "      font-family: sans-serif;",
      "    }",
      "    .box {",
      "      padding: 12px;",
      "      border: 1px solid #333;",
      "    }",
      "  </style>",
      "</head>",
      "<body>",
      "  <div class=\"box\" id=\"box\">",
      "    <button id=\"btn\">Click</button>",
      "    <p id=\"msg\">まだクリックされていません</p>",
      "  </div>",
      "",
      "  <script>",
      "    const btn = document.querySelector(\"#btn\");",
      "    const msg = document.querySelector(\"#msg\");",
      "",
      "    btn.addEventListener(\"click\", () => {",
      "      msg.textContent = \"クリックされた！\";",
      "    });",
      "  </script>",
      "</body>",
    ];

    const right = [
      "        var sb = new StringBuilder();",
      "",
      "",
      "        sb.AppendLine(\"<head>\");",
      "        sb.AppendLine(\"  <meta charset=\\\"utf-8\\\" />\");",
      "        sb.AppendLine(\"  <title>Mini Sample</title>\");",
      "        sb.AppendLine(\"  <style>\");",
      "        sb.AppendLine(\"    body {\");",
      "        sb.AppendLine(\"      font-family: sans-serif;\");",
      "        sb.AppendLine(\"    }\");",
      "        sb.AppendLine(\"    .box {\");",
      "        sb.AppendLine(\"      padding: 12px;\");",
      "        sb.AppendLine(\"      border: 1px solid #333;\");",
      "        sb.AppendLine(\"    }\");",
      "        sb.AppendLine(\"  </style>\");",
      "        sb.AppendLine(\"</head>\");",
      "        sb.AppendLine(\"<body>\");",
      "        sb.AppendLine(\"  <div class=\\\"box\\\" id=\\\"box\\\">\");",
      "        sb.AppendLine(\"    <button id=\\\"btn\\\">Click</button>\");",
      "        sb.AppendLine(\"    <p id=\\\"msg\\\">まだクリックされていません</p>\");",
      "        sb.AppendLine(\"  </div>\");",
      "        sb.AppendLine(\"  <script>\");",
      "        sb.AppendLine(\"    const btn = document.querySelector(\\\"#btn\\\");\");",
      "        sb.AppendLine(\"    const msg = document.querySelector(\\\"#msg\\\");\");",
      "        sb.AppendLine(\"    btn.addEventListener(\\\"click\\\", () => {\");",
      "        sb.AppendLine(\"      msg.textContent = \\\"クリックされた！\\\";\");",
      "        sb.AppendLine(\"    });\");",
      "        sb.AppendLine(\"  </script>\");",
      "        sb.AppendLine(\"</body>\");",
      "",
      "        return sb.ToString();",
    ];

    const ops = toPairedOps(left, right);
    const headIndex = ops.findIndex(
      (op) => op.type === "replace" && (op.leftLine ?? "").includes("<head>") &&
        (op.rightLine ?? "").includes("AppendLine(\"<head>\")"),
    );
    const sbIndex = ops.findIndex(
      (op) => op.type === "insert" && (op.rightLine ?? "").includes("StringBuilder"),
    );
    const blankInsert = ops.findIndex(
      (op) => op.type === "insert" && (op.rightLine ?? "").trim() === "" && op.rightLine !== undefined,
    );

    expect(sbIndex).toBeGreaterThanOrEqual(0);
    expect(blankInsert).toBeGreaterThanOrEqual(0);
    expect(headIndex).toBeGreaterThanOrEqual(0);
    expect(sbIndex).toBeLessThan(headIndex);
    expect(blankInsert).toBeLessThan(headIndex);

    expect(findReplace(ops, "<meta charset=\"utf-8\"", "AppendLine(\"  <meta charset")).toBe(true);
    expect(findReplace(ops, "<title>Mini Sample", "AppendLine(\"  <title>Mini Sample")).toBe(true);
    expect(findReplace(ops, "<style>", "AppendLine(\"  <style>\")")).toBe(true);
    expect(findReplace(ops, "font-family: sans-serif;", "AppendLine(\"      font-family")).toBe(true);
    expect(findReplace(ops, "padding: 12px;", "AppendLine(\"      padding: 12px")).toBe(true);
    expect(findReplace(ops, "border: 1px solid #333;", "AppendLine(\"      border: 1px solid #333")).toBe(true);
    expect(findReplace(ops, "<div class=\"box\" id=\"box\">", "AppendLine(\"  <div class")).toBe(true);
    expect(findReplace(ops, "<button id=\"btn\">Click</button>", "AppendLine(\"    <button id")).toBe(true);
    expect(findReplace(ops, "<p id=\"msg\">まだクリックされていません</p>", "AppendLine(\"    <p id")).toBe(true);
    expect(findReplace(ops, "const btn = document.querySelector", "AppendLine(\"    const btn")).toBe(true);
    expect(findReplace(ops, "const msg = document.querySelector", "AppendLine(\"    const msg")).toBe(true);
    expect(findReplace(ops, "btn.addEventListener", "AppendLine(\"    btn.addEventListener")).toBe(true);
    expect(findReplace(ops, "msg.textContent = \"クリックされた！\";", "AppendLine(\"      msg.textContent")).toBe(true);
    expect(findReplace(ops, "</script>", "AppendLine(\"  </script>\")")).toBe(true);
    expect(findReplace(ops, "</body>", "AppendLine(\"</body>\")")).toBe(true);
  });

  it("aligns AppendLine script block lines including closing });", () => {
    const left = [
      "  <script>",
      "    btn.addEventListener(\"click\", () => {",
      "      msg.textContent = \"クリックされた！\";",
      "    });",
      "  </script>",
    ];
    const right = [
      "        sb.AppendLine(\"  <script>\");",
      "        sb.AppendLine(\"    btn.addEventListener(\\\"click\\\", () => {\");",
      "        sb.AppendLine(\"      msg.textContent = \\\"クリックされた！\\\";\");",
      "        sb.AppendLine(\"    });\");",
      "        sb.AppendLine(\"  </script>\");",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "<script>", "AppendLine(\"  <script>\"")).toBe(true);
    expect(findReplace(ops, "btn.addEventListener", "AppendLine(\"    btn.addEventListener")).toBe(true);
    expect(findReplace(ops, "msg.textContent", "AppendLine(\"      msg.textContent")).toBe(true);
    expect(findReplace(ops, "});", "AppendLine(\"    });")).toBe(true);
    expect(findReplace(ops, "</script>", "AppendLine(\"  </script>\"")).toBe(true);
  });

  it("aligns additional HTML AppendLine variants (5+ cases)", () => {
    const left = [
      "<section>",
      "<div class=\"a  b\"></div>",
      "<!-- note -->",
      "<input name=\"user\" value=\"taro\">",
      "# Repository Guidelines (AGENTS.md)",
    ];
    const right = [
      "sb.AppendLine(@\"<section>\");",
      "sb.AppendLine(\"<div class=\\\"a b\\\"></div>\");",
      "sb.AppendLine(\"<!-- note -->\");",
      "sb.AppendLine($\"<input name=\\\"{name}\\\" value=\\\"{value}\\\">\");",
      "sb.AppendLine(\"# Repository Guidelines (AGENTS.md)\");",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "<section>", "<section>")).toBe(true);
    expect(findReplace(ops, "class=\"a  b\"", "class=\\\"a b\\\"")).toBe(true);
    expect(findReplace(ops, "<!-- note -->", "<!-- note -->")).toBe(true);
    expect(findReplace(ops, "<input name", "<input name")).toBe(true);
    expect(findReplace(ops, "# Repository Guidelines", "# Repository Guidelines")).toBe(true);
  });

  it("aligns additional CSS AppendLine variants (5+ cases)", () => {
    const left = [
      "@media (max-width: 768px) {",
      "  color: red;",
      "  background: url(\"a.png\");",
      "  padding: 0 8px;",
      "}",
    ];
    const right = [
      "sb.AppendLine($\"@media (max-width: {width}px) {{\");",
      "sb.AppendLine(@\"  color: red;\");",
      "sb.AppendLine(\"  background: url(\\\"a.png\\\");\");",
      "sb.AppendLine(\"  padding: 0 8px;\");",
      "sb.AppendLine(\"}\");",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "@media", "@media")).toBe(true);
    expect(findReplace(ops, "color: red", "color: red")).toBe(true);
    expect(findReplace(ops, "background: url", "background: url")).toBe(true);
    expect(findReplace(ops, "padding: 0 8px", "padding: 0 8px")).toBe(true);
    expect(findReplace(ops, "}", "}")).toBe(true);
  });

  it("aligns additional JS AppendLine variants with switch/case/default (5+ cases)", () => {
    const left = [
      "switch (value) {",
      "case 1:",
      "  return;",
      "default:",
      "  break;",
      "}",
    ];
    const right = [
      "js.AppendLine(\"switch (value) {\");",
      "js.AppendLine($\"case {value}:\");",
      "js.AppendLine(\"  return;\");",
      "js.AppendLine(\"default:\");",
      "js.AppendLine(\"  break;\");",
      "js.AppendLine(\"}\");",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "switch", "switch")).toBe(true);
    expect(findReplace(ops, "case 1:", "case")).toBe(true);
    expect(findReplace(ops, "return;", "return;")).toBe(true);
    expect(findReplace(ops, "default:", "default:")).toBe(true);
    expect(findReplace(ops, "break;", "break;")).toBe(true);
  });

  it("does not align mismatched append literal statements", () => {
    const left = ["return;"];
    const right = ["js.AppendLine(\"break;\");"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "return;", "break;")).toBe(false);
  });

  it("does not align close-but-different variable names", () => {
    const left = ["var foo = 1;"];
    const right = ["var food = 1;"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "foo", "food")).toBe(false);
  });

  it("does not align close-but-different function names", () => {
    const left = ["function test() {}"];
    const right = ["function test2() {}"];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "test()", "test2()")).toBe(false);
  });

  it("does not align far apart similar function names across separate blocks", () => {
    const left = [
      "function test() {}",
      "A",
      "B",
      "C",
      "D",
      "E",
    ];
    const right = [
      "A",
      "B",
      "C",
      "D",
      "E",
      "function test2() {}",
    ];

    const ops = toPairedOps(left, right);
    expect(findReplace(ops, "function test()", "function test2()")).toBe(false);
  });


  it("respects anchors as hard boundaries", () => {
    const left = ["TOP", "$foo = 1;", "ANCHOR", "function test() {}"];
    const right = ["TOP", "var foo = 1;", "ANCHOR", "string test() {}"];
    const anchors: Anchor[] = [{ leftLineNo: 2, rightLineNo: 2 }];

    const ops = diffWithAnchors(left.join("\n"), right.join("\n"), anchors);
    const anchorOp = ops.find(
      (op) => op.leftLine === "ANCHOR" && op.rightLine === "ANCHOR",
    );

    expect(anchorOp).toBeDefined();
    expect(findReplace(ops, "$foo", "var foo")).toBe(true);
    expect(findReplace(ops, "function test", "string test")).toBe(true);
  });
});
