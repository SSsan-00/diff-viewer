# Repository Structure

目的: ファイル構成の地図。コマンド説明は README に集約する。

```
.
├── AGENTS.md
├── README.md
├── STRUCTURE.md
├── spec.md
├── docs/
│   └── backlog.md
├── dist/
├── scripts/
├── src/
│   ├── storage/
│   └── ui/
├── public/
├── patches/
├── index.html
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.json
└── vite.config.ts
```

## src/ 全ファイル一覧

src/ 配下の全ファイルを網羅し、責務と依存方向（主に使われる側/使う側）を短く記す。

### src/（ルート直下）

- `src/main.ts` アプリ起動・UI組み立て・イベント配線の中心。多くの機能モジュールを参照する入口。
- `src/style.css` アプリ全体のスタイル定義（レイアウト/配色/装飾）。
- `src/licenses.ts` 依存ライセンス情報のデータソース。`src/main.ts` から参照される。
- `src/counter.ts` Vite テンプレート由来のサンプル関数（現在の実装では未使用）。
- `src/typescript.svg` Vite テンプレート由来のSVGアセット（現在の実装では未使用）。
- `src/smoke.test.ts` Vitest の動作確認用テスト。
- `src/distGate.test.ts` `dist/index.html` / `dist/index.min.html` の禁止文字列ゲート検査テスト。
- `src/distLayout.test.ts` 可読版/最適化版で主要レイアウトが一致することのテスト。
- `src/distReadableStyle.test.ts` 可読版と最適化版のCSS整合性テスト。
- `src/styleFileBoundary.test.ts` ファイル境界表示の `text-transform` を固定するCSSテスト。

### src/diffEngine/

- `src/diffEngine/types.ts` 差分モデル（LineOp/PairedOp/Range/InlineDiff）定義。
- `src/diffEngine/normalize.ts` 改行正規化（CRLF/CR → LF）。
- `src/diffEngine/normalize.test.ts` 改行正規化のユニットテスト。
- `src/diffEngine/lineSignature.ts` 行のキー抽出（ユニーク行/識別子抽出の補助）。
- `src/diffEngine/diffLines.ts` 行レベル差分（Myers + patience）を生成。
- `src/diffEngine/diffLines.test.ts` `diffLines` の基本ケース検証。
- `src/diffEngine/diffLinesAlignment.test.ts` 行対応が崩れないことの回帰テスト。
- `src/diffEngine/diffLinesSemanticAlignment.test.ts` 識別子ベースの対応付け検証。
- `src/diffEngine/pairReplace.ts` delete/insert を replace にペアリング（類似スコア込み）。
- `src/diffEngine/pairReplace.test.ts` ペアリングの振る舞いテスト。
- `src/diffEngine/lineSimilarity.ts` 行の特徴抽出・スコアリング（識別子/リテラル/カテゴリ）。
- `src/diffEngine/diffInline.ts` 行内差分（LCSベース）を算出。
- `src/diffEngine/diffInline.test.ts` 行内差分のユニットテスト。
- `src/diffEngine/diffBlocks.ts` 差分ブロック開始位置と行マッピングの補助。
- `src/diffEngine/diffBlocks.test.ts` ブロック抽出/行マッピングのテスト。
- `src/diffEngine/anchors.ts` アンカー検証・分割差分・追加/削除のロジック。
- `src/diffEngine/anchors.test.ts` アンカー検証/差分分割のテスト。
- `src/diffEngine/folding.ts` 折りたたみ対象範囲の算出。
- `src/diffEngine/folding.test.ts` 折りたたみ範囲のテスト。

### src/file/

- `src/file/decode.ts` 文字コードデコード（UTF-8/Shift_JIS/EUC-JP/auto）。
- `src/file/decode.test.ts` デコード判定のユニットテスト。
- `src/file/decodedFiles.ts` rawBytes から連結テキスト/セグメントを構築。
- `src/file/decodedFiles.test.ts` 再デコードとセグメント生成のテスト。
- `src/file/lineNumbering.ts` file-local 行番号の計算ユーティリティ。
- `src/file/lineNumbering.test.ts` 行番号フォーマット/情報取得のテスト。
- `src/file/loadErrors.ts` 読み込みエラー整形とログ判定。
- `src/file/loadErrors.test.ts` エラー整形のテスト。
- `src/file/loadMessages.ts` 読み込み完了メッセージの列挙生成。
- `src/file/loadMessages.test.ts` メッセージ生成のテスト。
- `src/file/postLoad.ts` 読み込み後処理の安全実行（例外吸収）。
- `src/file/postLoad.test.ts` post-load 実行のテスト。

### src/ui/

- `src/ui/template.ts` アプリのHTMLテンプレート定義。
- `src/ui/template.test.ts` ペイン操作UIの配置順テスト。
- `src/ui/anchorPanelToggle.ts` アンカーパネル折りたたみトグルの制御。
- `src/ui/anchorPanelToggle.test.ts` 折りたたみトグルのDOMテスト。
- `src/ui/anchorDecorations.ts` アンカーデコレーション（行/丸マーカー）の生成。
- `src/ui/anchorDecorations.test.ts` アンカーデコレーションの範囲/設定テスト。
- `src/ui/anchorClick.ts` アンカークリック時の状態遷移（追加/解除）。
- `src/ui/anchorClick.test.ts` アンカー操作のユニットテスト。
- `src/ui/fileBoundaryZones.ts` ファイル境界の表示ゾーン生成。
- `src/ui/fileBoundaryZones.test.ts` 境界ゾーン位置合わせのテスト。
- `src/ui/paneClear.ts` ペイン別クリアの処理。
- `src/ui/paneClear.test.ts` ペイン別クリアのDOMテスト。
- `src/ui/paneMessages.ts` 読み込み/エラー表示の設定・クリア。
- `src/ui/paneMessages.test.ts` メッセージ制御のテスト。
- `src/ui/editorFind.ts` Ctrl/Cmd+F の検索対象切り替え。
- `src/ui/editorFind.test.ts` Find ショートカットのテスト。
- `src/ui/diffJumpButtons.ts` 差分ジャンプボタンの有効/無効制御。
- `src/ui/diffJumpButtons.test.ts` 差分ジャンプ制御のテスト。
- `src/ui/wordWrapToggle.ts` ペイン別の折り返しトグル制御。
- `src/ui/wordWrapToggle.test.ts` 折り返しトグルのテスト。
- `src/ui/themeToggle.ts` テーマ切替（☀️/🌙）と保存/復元。
- `src/ui/themeToggle.test.ts` テーマ切替のテスト。

### src/storage/

- `src/storage/persistedState.ts` LocalStorage 永続化の読み書き・スケジューラ。
- `src/storage/persistedState.test.ts` 永続化の復元/保存テスト。

### src/scrollSync/

- `src/scrollSync/ScrollSyncController.ts` 左右スクロール連動の制御クラス。
- `src/scrollSync/ScrollSyncController.test.ts` スクロール連動のテスト。

### src/monaco/

- `src/monaco/monacoWorkers.ts` Monaco worker のURL設定。

### src/types/

- `src/types/monaco-editor-api.d.ts` Monaco API の型補助。

- `AGENTS.md` コントリビュータ向けの作業ガイド。
- `README.md` プロジェクト概要と使用方法。
- `STRUCTURE.md` 本ファイル。構成の目次。
- `spec.md` 仕様の Single Source of Truth。
- `docs/backlog.md` 改善案の待機所。
- `dist/` 配布成果物の出力先（`index.html` / `index.min.html`）。
- `scripts/` 配布物検証・成果物組み立て用の補助スクリプト。
- `scripts/assemble-dist.mjs` 最適化版の成果物を `dist/` に配置する。
- `scripts/format-readable.mjs` 可読版の `<style>` を整形するための補助スクリプト。
- `scripts/verify-dist.mjs` 配布物ゲートの検査スクリプト。
- `src/` TypeScript の実装本体。
- `src/main.ts` UI レイアウト/イベント結線の起点。
- `src/file/` ファイル読み込み・文字コードデコード・行番号表示の責務。
- `src/file/decode.ts` 文字コード判定とデコード処理。
- `src/file/loadErrors.ts` ファイル読み込み時のエラー整形とログ判定。
- `src/file/loadMessages.ts` 読み込み完了メッセージの生成（ファイル名列挙）。
- `src/file/postLoad.ts` 読み込み後の処理を安全に実行する補助。
- `src/file/decodedFiles.ts` rawBytes からテキスト/セグメントを再構築する。
- `src/file/lineNumbering.ts` file-local 行番号の計算。
- `src/diffEngine/anchors.ts` アンカーの検証と適用ロジック。
- `src/diffEngine/lineSimilarity.ts` 識別子/リテラルの類似スコア計算。
- `src/storage/` LocalStorage 永続化の読み書き。
- `src/ui/template.ts` UI の HTML テンプレート定義。
- `src/ui/anchorClick.ts` アンカー行クリック時の状態遷移。
- `src/ui/fileBoundaryZones.ts` 複数ファイル境界の表示ゾーン生成。
- `src/ui/editorFind.ts` Ctrl/Cmd+F の検索対象切替。
- `src/ui/diffJumpButtons.ts` 差分ジャンプボタンの有効/無効制御。
- `src/ui/paneClear.ts` ペイン別クリアの処理。
- `src/ui/paneMessages.ts` ペインの読み込み/エラー表示の制御。
- `src/ui/themeToggle.ts` テーマ切替（☀️/🌙）の状態管理。
- `src/style.css` 画面レイアウトと見た目のスタイル定義。
- `public/` 公開用の静的リソース置き場。
- `patches/` 依存関係向けのパッチ保管。
- `index.html` 開発用のエントリHTML。
- `package.json` スクリプトと依存関係。
- `pnpm-lock.yaml` pnpm の lockfile。
- `pnpm-workspace.yaml` pnpm ワークスペース設定。
- `tsconfig.json` TypeScript 設定。
- `vite.config.ts` Vite のビルド設定。
