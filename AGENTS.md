# Repository Guidelines

## プロジェクト構成
- `src/` に TypeScript の実装を配置。差分アルゴリズムは `src/diffEngine/`。
- テストはソースと同居し `*.test.ts` 命名（例: `src/diffEngine/diffBlocks.test.ts`）。
- `dist/index.html` / `dist/index.min.html` が単一ファイルの成果物（追加 JS/CSS なし）。
- 仕様は `spec.md` が唯一の正。`README.md` は必ず追従更新。
- 検証スクリプトは `scripts/`（`scripts/verify-dist.mjs`）。
- 構成の俯瞰は `STRUCTURE.md` を参照。

## 開発・ビルド・テストコマンド
- `pnpm install` 依存関係の導入（CI は `--frozen-lockfile` 推奨）。
- `pnpm run dev` 開発サーバーを起動。
- `pnpm run build` 通常ビルドを生成。
- `pnpm run build:single` 可読版/最適化版を生成し検証まで実行。
- `pnpm run build:single:minify` 最適化版のみ生成（検証は別途）。
- `pnpm run verify:dist` `dist/index.html` / `dist/index.min.html` を検証。
- `pnpm run test` / `pnpm run test:run` Vitest を実行。

## コーディング規約
- TypeScript、インデントは 2 スペース（既存の `src/**/*.ts` に合わせる）。
- `diffEngine/` は小さく純粋な関数を優先。必要に応じて型を明示。
- テストファイル名は `*.test.ts`。振る舞いが分かるテスト名にする。
- フォーマッタ/リンタは未導入のため、近傍の記法に合わせる。

## テスト方針
- テスト基盤は Vitest。
- 差分ロジックは `src/diffEngine/` のユニットテストで担保する。
- 個別実行は `pnpm run test:run -- <pattern>` を利用。

## コミット & PR 方針
- 既存履歴は短く要点を押さえたメッセージが中心。`feat:` / `chore:` 形式は任意。
- 1コミットは1目的。仕様変更時は `README.md` も同時更新。
- PR では概要・テスト結果・UI変更のスクショ/GIF を添付。

## リリース上の注意
- `dist/index.html` / `dist/index.min.html` は単一ファイルで完結。外部 URL / sourcemap / CI パス混入は不可。
- API/GitHub など外部依存を彷彿させる文字列や modulepreload polyfill を成果物に残さない。
- `github` / `api` の検出は単語境界・大小文字無視で行い、`<script>` / `<style>` 内は対象外。
- 可読版（`dist/index.html`）は `<style>` 内の CSS も整形済みで読みやすい状態を維持する。
- 配布前に `pnpm run verify:dist` を必ず実行。
