# Diff Viewer

VS Code っぽい差分ビューを **単一HTML**（`dist/index.html` のみ）で動かすための実験プロジェクトです。  
最重要ゴールは **スクロール連動 OFF（独立スクロール）** を実現することです。

## Features

- 2ペインの Monaco Editor で差分表示（行/行内ハイライト）
- スクロール連動 ON/OFF
- 差分再計算 / 前後ジャンプ
- アンカー行の追加・削除・ジャンプ
- 差分なし領域の折りたたみ（クリックで展開）
- ファイル読み込み（ドラッグ&ドロップ / ファイル選択）
- 文字コード選択（UTF-8 / Shift_JIS / EUC-JP / 自動）
- クリア（左右の内容とアンカーを全消去）

> 注意: エディタでの編集はメモリ上のみで、ファイルの保存/上書きは行いません。

---

## Usage（ビルド済みHTMLの使い方）

1) `dist/index.html` を開く（`file://` 直開きOK）  
2) 左右それぞれにファイルを読み込み or テキストを貼り付け  
3) `差分再計算` を押して差分表示  
4) アンカーは左右の行番号を順にクリックして追加（同じ行をクリックすると削除）

---

## Development

### Prerequisites

- Node.js（推奨: LTS）
- pnpm

#### pnpm の導入例

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm -v
```

---

## Single-file build（dist/index.html only）

### 1) Install dependencies

```bash
pnpm install
```

> CI や再現性重視の場合は `pnpm install --frozen-lockfile` を推奨します。

### 2) Build a single HTML file

```bash
pnpm run build:single
```

### 3) Open

- `dist/index.html` をブラウザで開く（`file://` 直開き）

---

## Built file verification（受け入れ条件）

ビルド後の `dist/index.html` で、少なくとも次を確認してください。

### Functional checks

- Monaco editors render
- Diff recalculation
- Scroll sync ON/OFF
- Next/previous diff jump
- Folding（差分なし領域の折りたたみ）
- File load（drag & drop + file input）
- Shift_JIS / EUC-JP decoding
- Anchors add/remove/jump/decorations
- Clear button resets both editors + anchors

### Release gate（配布物の禁止事項）

最終成果物 `dist/index.html` に、次の文字列が **含まれていないこと** を確認してください。

- `http://`
- `https://`
- `GITHUB_WORKSPACE`

また、`dist/index.html` は **単一ファイル**で完結していること（追加の `.js` / `.css` / `.map` が不要）を条件とします。

> 目的: 外部参照を想起させる文字列や CI 環境由来のパス/メタ情報が、成果物に混入するのを防ぐため。

---

## Notes

- 本プロジェクトは「VS Code と同一アルゴリズム」を目指すのではなく、ユーザーが違和感の少ない “VS Code っぽい体験” を優先します。
- 詳細な仕様は `spec.md` を参照してください。
