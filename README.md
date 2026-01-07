# Diff Viewer

VS Code っぽい差分ビューを **単一HTML**（`dist/index.html` / `dist/index.min.html`）で動かすための実験プロジェクトです。  
最重要ゴールは **スクロール連動 OFF（独立スクロール）** を実現することです。

## Features

- 2ペインの Monaco Editor で差分表示（行/行内ハイライト）
- スクロール連動 ON/OFF
- 差分再計算 / 前後ジャンプ
- アンカー行（手動）の追加・削除・ジャンプ
- **自動アンカー（DOCTYPE）**：左右に `<!DOCTYPE`（または `<！DOCTYPE`）がある場合、その行同士を再計算時にアンカーとして扱う
- アンカーパネルの折りたたみ/展開
- 差分なし領域の折りたたみ（クリックで展開）
- 言語差のある行も識別子ベースで対応付け
- ファイル読み込み
  - ファイル選択（複数選択対応）
  - ドラッグ&ドロップ（ペイン全面、複数ファイル対応）
  - 既存内容がある場合は **末尾に改行を挟んで追記**
- 文字コード選択（UTF-8 / Shift_JIS / EUC-JP / 自動）
  - **混在文字コードに対応**：複数ファイル読み込み時も、ファイル単位でデコードして文字化けを防止
- クリア（左右の内容とアンカーを全消去）
- 複数ファイル読み込み時、後から追加したファイルは行番号が1から再カウント（表示のみ）
- アンカー一覧の行番号は file-local 表示（ファイル識別バッジ付き）

> 注意: エディタでの編集はメモリ上のみで、ファイルの保存/上書きは行いません。

---

## Usage（ビルド済みHTMLの使い方）

1) `dist/index.html`（可読版）または `dist/index.min.html`（最適化版）を開く（`file://` 直開きOK）  
2) 左右それぞれにファイルを読み込み or テキストを貼り付け  
3) `差分再計算` を押して差分表示  
4) アンカーは左右の行番号を順にクリックして追加（同じ行をクリックすると削除）

### ファイル読み込み（複数ファイルの連結）

- **ファイル選択**で複数選んだ場合、選択された順（FileList の順）に連結します。
- **ドラッグ&ドロップ**はペイン内のどこでも受け付けます（ドラッグ中はペインをハイライト）。
- 読み込み先エディタに既に内容がある場合、**末尾が改行でなければ `\n` を1つ追加**してから追記します。
- 複数ファイル連結時も、ファイル境界は **改行で区切られる**ようにします（改行を過剰に増やさない）。
- ファイル境界は **表示上の余白**を追加して見やすくし、論理行番号とは分離します。

### 自動アンカー（DOCTYPE）

- `差分再計算` 実行時、左右のテキスト内に `<!DOCTYPE`（または `<！DOCTYPE`）を含む行が存在する場合、
  - 左右それぞれで **最初に見つかった DOCTYPE 行同士**を **自動アンカー（1件）**として扱います。
- 既存アンカーと矛盾（順序逆転・重複など）する場合は、自動アンカーは追加しません（安定性優先）。

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

## Single-file build（dist/index.html / dist/index.min.html）

### 1) Install dependencies

```bash
pnpm install
```

> CI や再現性重視の場合は `pnpm install --frozen-lockfile` を推奨します。

### 2) Build a single HTML file

```bash
pnpm run build:single
```

> `build:single` は可読版/最適化版の両方を生成し、`verify:dist` まで実行します。  
> 可読版は HTML 全体に加えて `<style>` 内の CSS も整形済みで読みやすい状態を期待します。  
> `build:single:minify` は最適化版のみを生成します（検証は別途）。

### 3) Verify dist artifact

```bash
pnpm run verify:dist
```

> `dist/index.html` と `dist/index.min.html` の両方を検査します。

### 4) Open

- `dist/index.html` / `dist/index.min.html` をブラウザで開く（`file://` 直開き）

---

## Project Structure

- 構成の概要は `STRUCTURE.md` を参照してください。

---

## Built file verification（受け入れ条件）

ビルド後の `dist/index.html` / `dist/index.min.html` で、少なくとも次を確認してください。

### Functional checks

- Monaco editors render
- Diff recalculation
- Scroll sync ON/OFF
- Next/previous diff jump
- Folding（差分なし領域の折りたたみ）
- File load（file input / drag & drop）
  - multiple files append + newline rules
  - mixed encodings decode correctly（UTF-8 / Shift_JIS / EUC-JP）
- Anchors add/remove/jump/decorations
- Auto anchor for DOCTYPE works on diff recalculation
- Clear button resets both editors + anchors

### Release gate（配布物の禁止事項）

最終成果物 `dist/index.html` / `dist/index.min.html` に、次の文字列が **含まれていないこと** を確認してください。

- `http://`
- `https://`
- `GITHUB_WORKSPACE`
- API/GitHubなど外部依存を彷彿させる文字列（例: `github.com`, `api.github.com`, `raw.githubusercontent.com`）
- `github` / `api` は **単語境界**かつ **大小文字無視**で検出（`<script>` / `<style>` 内は対象外）

加えて、`dist/index.html` / `dist/index.min.html` に SourceMap 参照や inline sourcemap が含まれていないこと、  
modulepreload の polyfill 関数が含まれていないことを確認してください。  
これらは **置換で回避しない**（ビルド/バンドル段階で含まれない状態を保証する）。

また、`dist/index.html` / `dist/index.min.html` は **単一ファイル**で完結していること（追加の `.js` / `.css` / `.map` が不要）を条件とします。

> 目的: 外部参照を想起させる文字列や CI 環境由来のパス/メタ情報が、成果物に混入するのを防ぐため。

---

## Notes

- 本プロジェクトは「VS Code と同一アルゴリズム」を目指すのではなく、ユーザーが違和感の少ない “VS Code っぽい体験” を優先します。
- 詳細な仕様は `spec.md` を参照してください。

---

## Documentation policy

- `spec.md` は本プロジェクトの Single Source of Truth（仕様の唯一の正）です。
- `README.md` は **常に最新の仕様（spec.md）に追従**する方針で更新します。
  - 機能追加・挙動変更・ビルド手順変更が入った場合は、同じPR/コミット内で README も更新します。
