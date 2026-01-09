# Repository Guidelines (AGENTS.md)

このリポジトリは **VS Code 風の差分ビューを、HTML 単体・スタンドアロンで再現する**
ことを目的としたプロジェクトである。  
最大の特徴は **スクロール連動 ON / OFF の切り替えと、再計算可能な差分構造** にある。

本ドキュメントは、人間・Codex・将来の協力者すべてにとっての
**「安全に変更するための契約」** として機能する。

---

## プロジェクト構成

- `src/`
  - TypeScript の実装を配置
  - 差分アルゴリズムは **`src/diffEngine/` に集約**
    - diff は UI から完全に独立した純粋ロジックとして扱う
- `src/ui/template.ts`
  - UI の HTML テンプレートはここに **集約**
  - DOM 構造を分散させない（diff 表示構造の一貫性を保つため）
- テスト
  - ソースと同居し `*.test.ts` 命名
  - 例: `src/diffEngine/diffBlocks.test.ts`
- 成果物
  - `dist/index.html`
  - `dist/index.min.html`
  - **どちらも単一 HTML ファイル**
  - 追加の JS / CSS / asset は一切生成しない
- 仕様
  - **唯一の正は `doc/SPEC.md`**
  - `README.md` は必ず SPEC に追従させる
- 検証スクリプト
  - `scripts/verify-dist.mjs`
- 構成俯瞰
  - `doc/STRUCTURE.md`
- 初回セットアップ
  - `doc/SETUP.md`

---

## 開発・ビルド・テストコマンド

- `pnpm install`
  - 依存関係の導入
  - CI では `--frozen-lockfile` 推奨
- `pnpm run dev`
  - 開発サーバー起動
- `pnpm run build`
  - 通常ビルド
- `pnpm run build:single`
  - 可読版 / 最適化版を生成し **検証まで実行**
- `pnpm run build:single:minify`
  - 最適化版のみ生成（検証は別途）
- `pnpm run verify:dist`
  - `dist/index.html` / `dist/index.min.html` を検証
- `pnpm run test`
- `pnpm run test:run`

---

## 実装思想（重要）

### 差分エンジン (`diffEngine/`)

- UI・DOM・イベントを **一切知らない**
- 入力と出力が明確な **純粋関数** を基本とする
- 状態を持たせる場合も「再計算可能」であること
- VS Code と同一実装を目指すのではなく
  - **挙動互換**
  - **利用感の近さ**
  - **再計算・手動介入可能性**
  を優先する

### UI / 表示

- 差分構造は **描画前に確定していること**
- 表示のために diff ロジックをねじ曲げない
- 「スクロール連動 OFF」は例外機能ではなく **第一級機能**

---

## コーディング規約

- TypeScript
- インデントは **2 スペース**
- 既存の `src/**/*.ts` の記法を最優先で踏襲
- `diffEngine/` は
  - 小さく
  - 読めて
  - テストしやすい
  関数を積み重ねる
- 型は「分かるところまで」明示する
  - 無理な厳密化はしない
- フォーマッタ / リンターは未導入
  - **近傍コードに合わせることが最重要**

---

## テスト方針

- テスト基盤は **Vitest**
- 差分ロジックの正しさは
  - `src/diffEngine/` のユニットテストで担保
- UI は
  - ロジックが壊れていないことを前提に目視確認
- テスト名は
  - 「何が保証されているか」が読める日本語 / 英語混在可

---

## コミット & PR 方針

- 既存履歴は
  - 短く
  - 要点重視
- 形式は `feat:` / `chore:` 任意
- **1コミット = 1目的**
- 仕様変更時は
  - `doc/SPEC.md`
  - `README.md`
  を必ず更新
- PR には以下を含める
  - 変更概要
  - テスト結果
  - UI 変更があればスクショ / GIF

---

## リリース上の注意（最重要）

### 単一ファイル制約

- `dist/index.html` / `dist/index.min.html` は
  - **完全に自己完結**
- 外部 URL / CDN / sourcemap / CI パス混入 **禁止**

### 禁止ワード・検証ルール

- `github`
  - 単語境界
  - 大小文字無視
  - `<script>` / `<style>` を含む成果物全体が対象
- `api`
  - 単語境界
  - 大小文字無視
  - `<script>` / `<style>` 内は対象外
- modulepreload polyfill を成果物に残さない
- 外部依存を **「連想させる文字列」も不可**

### 可読版 (`dist/index.html`)

- HTML の可読性を最優先
- `<style>` 内 CSS は
  - 見た目の一致を優先
  - 整形は可能な範囲で行う
- 整形によって挙動を壊してはいけない

### 配布前チェック

- **必ず**
  ```sh
  pnpm run verify:dist