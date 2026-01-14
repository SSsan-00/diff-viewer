# Repository Structure

目的: ファイル構成の地図。コマンド説明は README に集約する。

```
.
├── AGENTS.md
├── README.md
├── doc/
│   ├── BACKLOG.md
│   ├── SETUP.md
│   ├── SPEC.md
│   └── STRUCTURE.md
├── dist/
├── public/
├── scripts/
├── src/
│   ├── diffEngine/
│   ├── file/
│   ├── monaco/
│   ├── scrollSync/
│   ├── storage/
│   ├── types/
│   └── ui/
├── patches/
├── index.html
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.json
└── vite.config.ts
```

## src/ 全ファイル一覧（84件）

### src/

- `src/main.ts` アプリ起点。Monaco 初期化、イベント配線、差分再計算、アンカー描画、読み込み/保存を統合。主に `src/ui/*` / `src/diffEngine/*` / `src/file/*` / `src/storage/*` を利用。
- `src/style.css` 画面全体のレイアウト/配色/差分ハイライト/アンカー/境界表示のスタイル。`src/main.ts` から読み込む。
- `src/licenses.ts` 依存ライセンス本文データ。export: `THIRD_PARTY_LICENSES`（`src/main.ts` から参照）。
- `src/smoke.test.ts` Vitest の起動確認用スモークテスト。
- `src/distGate.test.ts` 配布物ゲート（禁止文字列/SourceMap/modulepreload）の検査テスト。
- `src/distLayout.test.ts` テンプレート構造（ペイン/ツールバー/ドロップUI）の回帰テスト。
- `src/distReadableStyle.test.ts` 可読版/最適化版の CSS 一致とデータ URL 維持のテスト。
- `src/styleFileBoundary.test.ts` ファイル境界 CSS が大文字化しないことのテスト。
- `src/styleThemeDark.test.ts` ダークテーマの inline diff 配色トークン検証テスト。
- `src/indexHtml.test.ts` `index.html` の favicon 埋め込み（data URL）テスト。

### src/diffEngine/

- `src/diffEngine/types.ts` 差分モデルの型定義。exports: `LineOp`, `PairedOp`, `Range`, `InlineDiff`。
- `src/diffEngine/normalize.ts` 改行正規化（CRLF/CR → LF）。export: `normalizeText`。
- `src/diffEngine/normalize.test.ts` `normalizeText` のユニットテスト。
- `src/diffEngine/lineSignature.ts` 行の識別キー抽出（ユニーク行・対応付け補助）。export: `extractLineKey`。
- `src/diffEngine/lineSignature.test.ts` 識別キー抽出のテスト。
- `src/diffEngine/lineSimilarity.ts` 行のトークン化/スコア計算（識別子/リテラル/埋め込みCSS/JS/HTMLの補助トークン）。exports: `buildLineFeatures`, `scoreLinePair`, `extractIndexTokens`。
- `src/diffEngine/diffLines.ts` 行レベル差分（Myers + ユニーク行優先）。exports: `diffLinesFromLines`, `diffLines`。
- `src/diffEngine/diffLines.test.ts` 行差分の基本ケーステスト。
- `src/diffEngine/diffLinesAlignment.test.ts` 行対応の安定性テスト。
- `src/diffEngine/diffLinesSemanticAlignment.test.ts` 識別子ベースの対応付けテスト。
- `src/diffEngine/pairReplace.ts` delete/insert を replace にペアリングする補助。export: `pairReplace`。
- `src/diffEngine/pairReplace.test.ts` `pairReplace` のテスト。
- `src/diffEngine/diffInline.ts` 行内差分の算出（LCS ベース）。export: `diffInline`。
- `src/diffEngine/diffInline.test.ts` 行内差分のテスト。
- `src/diffEngine/diffBlocks.ts` 行差分を表示用のペア行へ変換する補助。exports: `getDiffBlockStarts`, `mapRowToLineNumbers`。
- `src/diffEngine/diffBlocks.test.ts` ブロック/行マッピングのテスト。
- `src/diffEngine/anchors.ts` アンカー検証・分割差分のロジック。exports: `addAnchor`, `removeAnchorByLeft`, `removeAnchorByRight`, `validateAnchors`, `diffWithAnchors` ほか。
- `src/diffEngine/anchors.test.ts` アンカー検証のテスト。
- `src/diffEngine/folding.ts` 折りたたみ対象範囲の算出。exports: `buildFoldRanges`, `findFoldContainingRow`。
- `src/diffEngine/folding.test.ts` 折りたたみ範囲のテスト。

### src/file/

- `src/file/decode.ts` 文字コードデコード（UTF-8/SJIS/EUC-JP/auto）。exports: `FileEncoding`, `decodeArrayBuffer`。
- `src/file/decode.test.ts` `decodeArrayBuffer` のユニットテスト。
- `src/file/fileOrder.ts` 複数ファイル読み込み時の順序調整（cshtml.cs → cshtml）。export: `reorderRazorPairs`。
- `src/file/fileOrder.test.ts` cshtml ペア順序のテスト。
- `src/file/decodedFiles.ts` rawBytes から連結テキスト/セグメントを生成。exports: `FileBytes`, `DecodedFilesResult`, `buildDecodedFiles`。
- `src/file/decodedFiles.test.ts` 再デコード/セグメント生成のテスト。
- `src/file/lineNumbering.ts` file-local 行番号フォーマット/取得ユーティリティ。exports: `LineSegment`, `LineSegmentInfo`, `getLineSegmentInfo`, `createLineNumberFormatter`。
- `src/file/lineNumbering.test.ts` 行番号計算のテスト。
- `src/file/segmentAppend.ts` 追加入力時の末尾改行の扱いを正規化。export: `normalizeLastSegmentForAppend`。
- `src/file/segmentAppend.test.ts` 末尾改行の正規化テスト。
- `src/file/loadMessages.ts` 読み込み完了メッセージの整形（ファイル名列挙）。exports: `formatLoadSuccessLabel`, `listLoadedFileNames`。
- `src/file/loadMessages.test.ts` メッセージ生成のテスト。
- `src/file/loadErrors.ts` 読み込みエラー整形とログ判定。exports: `isInitializationReferenceError`, `formatFileLoadError`, `shouldLogFileLoadError`。
- `src/file/loadErrors.test.ts` エラー整形のテスト。
- `src/file/postLoad.ts` 読み込み後タスクの安全実行（例外吸収）。export: `runPostLoadTasks`。
- `src/file/postLoad.test.ts` post-load 実行のテスト。
- `src/file/language.ts` ファイル名から Monaco の言語IDを推定し、ペイン単位の言語を決定。exports: `detectLanguageFromFileName`, `inferPaneLanguage`。
- `src/file/language.test.ts` 拡張子→言語推定のテスト。

### src/ui/

- `src/ui/template.ts` アプリの HTML テンプレート定義。export: `APP_TEMPLATE`。
- `src/ui/template.test.ts` テンプレート内の UI 配置テスト。
- `src/ui/paneClear.ts` ペイン別クリアボタンのバインド。exports: `clearPaneState`, `bindPaneClearButton`。
- `src/ui/paneClear.test.ts` クリア挙動のテスト。
- `src/ui/paneMessages.ts` ペインの読み込み/エラーメッセージ制御。exports: `setPaneMessage`, `clearPaneMessage`。
- `src/ui/paneMessages.test.ts` メッセージ制御のテスト。
- `src/ui/editorFind.ts` Ctrl/Cmd+F をフォーカスペインへ誘導。exports: `handleFindShortcut` と関連型。
- `src/ui/editorFind.test.ts` Find ショートカットのテスト。
- `src/ui/wordWrapToggle.ts` 折り返しの適用処理（UIトグル用、現在は未配線）。export: `bindWordWrapToggle`。
- `src/ui/wordWrapToggle.test.ts` 折り返し切替のテスト。
- `src/ui/wordWrapShortcut.ts` Alt+Z の折り返しショートカット（UI無しの操作経路）。export: `bindWordWrapShortcut`。
- `src/ui/wordWrapShortcut.test.ts` Alt+Z ショートカットのテスト。
- `src/ui/syntaxHighlightToggle.ts` シンタックスハイライトの ON/OFF を切替。export: `bindSyntaxHighlightToggle`。
- `src/ui/syntaxHighlightToggle.test.ts` ハイライト切替のテスト。
- `src/ui/editorOptions.ts` Monaco エディタ生成用の共通オプション（sticky scroll 無効化含む）。export: `createEditorOptions`。
- `src/ui/editorOptions.test.ts` エディタ生成オプションのテスト。
- `src/ui/themeToggle.ts` ☀️/🌙 テーマ切替と保存。exports: `setupThemeToggle`, `ThemeMode`。
- `src/ui/themeToggle.test.ts` テーマ切替のテスト。
- `src/ui/diffJumpButtons.ts` 差分ジャンプボタンの有効/無効制御。export: `updateDiffJumpButtons`。
- `src/ui/diffJumpButtons.test.ts` 差分ジャンプのテスト。
- `src/ui/anchorPanelToggle.ts` アンカーパネル折りたたみ制御。exports: `setupAnchorPanelToggle`, `setAnchorPanelCollapsed`。
- `src/ui/anchorPanelToggle.test.ts` 折りたたみ UI のテスト。
- `src/ui/anchorClick.ts` 行クリックでのアンカー追加/解除ロジック。exports: `handleLeftAnchorClick`, `handleRightAnchorClick` と関連型。
- `src/ui/anchorClick.test.ts` アンカー操作のテスト。
- `src/ui/anchorDecorations.ts` アンカー装飾（行ハイライト/丸マーカー）生成。export: `buildAnchorDecorations` と関連型。
- `src/ui/anchorDecorations.test.ts` アンカー装飾のテスト。
- `src/ui/anchorReset.ts` クリア時のアンカー状態/装飾を一括リセット。export: `resetAllAnchors` と関連型。
- `src/ui/anchorReset.test.ts` アンカーリセットのテスト。
- `src/ui/fileBoundaryZones.ts` ファイル境界の表示ゾーン生成（差分行と整列）。exports: `buildAlignedFileBoundaryZones` と関連型。
- `src/ui/fileBoundaryZones.test.ts` 境界ゾーンのテスト。

### src/storage/

- `src/storage/persistedState.ts` LocalStorage 保存/復元とスケジューラ。exports: `STORAGE_KEY`, `STORAGE_VERSION`, `loadPersistedState`, `savePersistedState`, `clearPersistedState`, `createPersistScheduler`。
- `src/storage/persistedState.test.ts` 永続化のテスト。

### src/scrollSync/

- `src/scrollSync/ScrollSyncController.ts` 左右スクロール連動の制御クラス。exports: `ScrollSyncController` と関連型。
- `src/scrollSync/ScrollSyncController.test.ts` スクロール連動のテスト。

### src/monaco/

- `src/monaco/monacoWorkers.ts` Monaco worker の URL 設定（単体 HTML 向け）。export: `setupMonacoWorkers`。
- `src/monaco/basicLanguages.ts` Monarch 言語定義を直接登録する薄いラッパー。export: `registerBasicLanguages`。

### src/types/

- `src/types/monaco-editor-api.d.ts` Monaco API の型補助（`monaco` 型の最小サポート）。
