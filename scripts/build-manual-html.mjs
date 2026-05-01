import fs from "node:fs/promises";
import path from "node:path";

const OUT_FILE = path.resolve("doc/MANUAL.html");
const ASSET_DIR = path.resolve("doc/manual-assets");

const IMAGE_SPECS = [
  { alt: "初期画面", file: "overview.png" },
  { alt: "差分が見える読み込み状態", file: "diff.png" },
  { alt: "ファイルカードで先頭にジャンプ", file: "file-card-jump.png" },
  { alt: "差分の表示例", file: "diff.png" },
  { alt: "主要トグルの位置", file: "toggles.png" },
  { alt: "ダークテーマ表示", file: "dark-theme.png" },
  { alt: "レポート出力（シンプル）", file: "report-simple.png" },
  { alt: "レポート出力（リッチ）", file: "report-rich.png" },
  { alt: "アンカー一覧と差分", file: "anchors.png" },
  { alt: "ワークスペース一覧", file: "workspace.png" },
  { alt: "パス登録機能", file: "paths.png" },
  { alt: "行ジャンプ機能", file: "goto-line.png" },
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function loadImage(name) {
  const filePath = path.join(ASSET_DIR, name);
  const buffer = await fs.readFile(filePath);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

let html = await fs.readFile(OUT_FILE, "utf8");

for (const spec of IMAGE_SPECS) {
  const src = await loadImage(spec.file);
  const pattern = new RegExp(
    `(<img\\s+src=")(?:data:image\\/png;base64,[^"]*|\\$\\{images\\.[^}]+\\})(" alt="${escapeRegExp(spec.alt)}")`,
    "g",
  );

  let count = 0;
  html = html.replace(pattern, (_, prefix, suffix) => {
    count += 1;
    return `${prefix}${src}${suffix}`;
  });

  if (count !== 1) {
    throw new Error(`manual image placeholder not found uniquely for alt="${spec.alt}"`);
  }
}

await fs.writeFile(OUT_FILE, html);
console.log(`Wrote ${OUT_FILE}`);
