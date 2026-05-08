# Repository Structure

目的: ファイル構成の地図。コマンド説明は README に集約する。

```
.
├── AGENTS.md
├── README.md
├── doc/
│   ├── BACKLOG.md
│   ├── MANUAL.html
│   ├── manual.md
│   ├── manual-assets/
│   ├── SETUP.md
│   ├── SPEC.md
│   └── STRUCTURE.md
├── dist/
├── public/
├── rust/
├── scripts/
├── src/
│   ├── diffEngine/
│   ├── file/
│   ├── manual/
│   ├── monaco/
│   ├── perf/
│   ├── scrollSync/
│   ├── storage/
│   ├── types/
│   └── ui/
├── text/
├── patches/
├── index.html
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── vite.config.ts
```

## src/ 主要ファイル一覧

注記: 役割の理解に必要な主要ファイルに絞って記載する。全量の列挙は更新コストが高く、実装との差分が生じやすいため採用しない。

### src/

- `src/main.ts` アプリ起点。マニュアル表示モードの早期分岐、Monaco 初期化、ショートカット/フォーカス管理、差分再計算、アンカー描画、読み込み/保存、runtime perf 記録を統合。`src/ui/*` / `src/diffEngine/*` / `src/file/*` / `src/storage/*` / `src/manual/*` / `src/perf/*` を束ねる。
- `src/appMode.ts` URL パラメータから保存あり/保存なし画面、manual 表示、diff engine (`auto|ts|wasm`) を解決する。export: `resolveAppMode`。
- `src/appMode.test.ts` 保存あり/保存なし、manual、diff engine モード解決のテスト。
- `src/style.css` 画面全体のレイアウト/配色/差分ハイライト/アンカー/境界表示のスタイル。ワークスペース/パス登録UIのパネルも定義する。`src/main.ts` から読み込む。
- `src/licenses.ts` 依存ライセンス本文データ。export: `THIRD_PARTY_LICENSES`（`src/main.ts` から参照）。
- `src/smoke.test.ts` Vitest の起動確認用スモークテスト。
- `src/distGate.test.ts` 配布物ゲート（禁止文字列/SourceMap/modulepreload）の検査テスト。
- `src/distLayout.test.ts` テンプレート構造（ペイン/ツールバー/ドロップUI）の回帰テスト。
- `src/distReadableStyle.test.ts` 可読版/最適化版の CSS 一致とデータ URL 維持のテスト。
- `src/styleFileBoundary.test.ts` ファイル境界 CSS が大文字化しないことのテスト。
- `src/styleThemeDark.test.ts` ダークテーマの inline diff 配色トークン検証テスト。
- `src/indexHtml.test.ts` `index.html` の favicon 埋め込み（data URL）テスト。

### src/manual/

- `src/manual/navigation.ts` マニュアル表示URL生成と、ファイルハンドル復元可否に応じた遷移/全面表示の判定。exports: `createManualUrl`, `createAppUrl`, `resolveManualPresentationMode`。
- `src/manual/navigation.test.ts` マニュアルURL生成と表示方式判定のテスト。
- `src/manual/manualViewer.ts` 埋め込み `MANUAL.html` の取得、script-safe エンコード、iframe ベースのマニュアル表示。exports: `renderManualViewer`, `getEmbeddedManualHtml` ほか。
- `src/manual/manualViewer.test.ts` マニュアル埋め込み取得と表示のテスト。

### src/diffEngine/

- `src/diffEngine/types.ts` 差分モデルの型定義。exports: `LineOp`, `PairedOp`, `Range`, `InlineDiff`。
- `src/diffEngine/normalize.ts` 改行正規化（CRLF/CR → LF）。export: `normalizeText`。
- `src/diffEngine/normalize.test.ts` `normalizeText` のユニットテスト。
- `src/diffEngine/lineSignature.ts` 行の識別キー抽出（ユニーク行・対応付け補助）。Razor `@:` の比較用正規化を含む。export: `extractLineKey`。
- `src/diffEngine/lineSignature.test.ts` 識別キー抽出のテスト。
- `src/diffEngine/lineSimilarity.ts` 行のトークン化/スコア計算（識別子/リテラル/埋め込みCSS/JS/HTMLの補助トークン）。Razor `@:` を比較時に除去し、AppendLine や `+=`/`.=` の文字列中身（空白正規化）を比較に活用する。コメント行は本文を抽出して比較する。exports: `buildLineFeatures`, `scoreLinePair`, `extractIndexTokens`, `normalizeCommentText`。
- `src/diffEngine/lineSimilarity.test.ts` 行類似度スコア計算のテスト。
- `src/diffEngine/lineSimilarityComment.test.ts` コメント行比較のテスト。
- `src/diffEngine/diffLines.ts` 行レベル差分（Myers + ユニーク行優先）。exports: `diffLinesFromLines`, `diffLines`。
- `src/diffEngine/diffLines.test.ts` 行差分の基本ケーステスト。
- `src/diffEngine/diffLinesAlignment.test.ts` 行対応の安定性テスト。
- `src/diffEngine/diffLinesIgnoreLeadingWhitespace.test.ts` 行頭空白無視時の対応付けテスト。
- `src/diffEngine/diffLinesSemanticAlignment.test.ts` 識別子ベースの対応付けテスト。
- `src/diffEngine/pairReplace.ts` delete/insert を replace にペアリングする補助。空行が挟まるケースでも順序を崩さず対応行を揃える。export: `pairReplace`。
- `src/diffEngine/pairReplace.test.ts` `pairReplace` のテスト。
- `src/diffEngine/appendLiteral.ts` AppendLine 系のラッパー文字列を扱う補助。exports: `extractAppendLiteral`, `isAppendLiteralWrapperPair` ほか。
- `src/diffEngine/appendLiteral.test.ts` AppendLine ラッパー判定のテスト。
- `src/diffEngine/diffInline.ts` 行内差分の算出（LCS ベース）。batched 実行と AppendLine 向け補正を含む。exports: `diffInline`, `diffInlineBatch` ほか。
- `src/diffEngine/diffInline.test.ts` 行内差分のテスト。
- `src/diffEngine/htmlAttributeSpaceDiff.ts` HTML 属性内空白差分の可視化補助。export: `diffHtmlAttributeSpace`.
- `src/diffEngine/htmlAttributeSpaceDiff.test.ts` HTML 属性内空白差分のテスト。
- `src/diffEngine/replaceVisibility.ts` replace 行の表示可否判定と inline diff 再利用を担当。export: `prepareReplaceOpsForDisplay`。
- `src/diffEngine/replaceVisibility.test.ts` replace 表示判定のテスト。
- `src/diffEngine/diffBlocks.ts` 行差分を表示用のペア行へ変換する補助。exports: `getDiffBlockStarts`, `mapRowToLineNumbers`。
- `src/diffEngine/diffBlocks.test.ts` ブロック/行マッピングのテスト。
- `src/diffEngine/anchors.ts` アンカー検証・分割差分のロジック。exports: `addAnchor`, `removeAnchorByLeft`, `removeAnchorByRight`, `validateAnchors`, `diffWithAnchors` ほか。
- `src/diffEngine/anchors.test.ts` アンカー検証のテスト。
- `src/diffEngine/anchorOnly.ts` `?diff=off` 用の手動アンカー行だけを差分扱いする表示行生成。export: `buildAnchorOnlyPairedOps`。
- `src/diffEngine/anchorOnly.test.ts` 通常差分計算OFFモードの表示行生成テスト。
- `src/diffEngine/highlightPolicy.ts` `?highlight=off` 用の差分装飾可否判定。exports: `buildManualAnchorHighlightKeys`, `shouldShowDiffHighlight`。
- `src/diffEngine/highlightPolicy.test.ts` 通常差分ハイライトOFFモードの装飾判定テスト。
- `src/diffEngine/folding.ts` 折りたたみ対象範囲の算出。exports: `buildFoldRanges`, `findFoldContainingRow`。
- `src/diffEngine/folding.test.ts` 折りたたみ範囲のテスト。
- `src/diffEngine/embeddedOutputCall.ts` 埋め込み WASM 呼び出し結果の decode/検証を共通化する補助。exports: `decodeEmbeddedDiffResponse` ほか。
- `src/diffEngine/embeddedDiffWasm.ts` 単一 HTML に埋め込む WASM バイナリ本体と metadata。exports: `EMBEDDED_DIFF_WASM_*`。
- `src/diffEngine/engine.ts` `ts|wasm|auto` の差し替え層。line diff / inline diff / anchors セグメントを optional に WASM 実装へ流す。exports: `createDiffEngine`, `getDiffEngineAvailability`。
- `src/diffEngine/engine.test.ts` TS/WASM parity と fallback のテスト。

### src/file/

segments 管理（ファイル分割・行番号・連結）は `decodedFiles.ts` / `lineNumbering.ts` / `segmentIndex.ts` / `segmentAppend.ts` が担う。

- `src/file/decode.ts` 文字コードデコード（UTF-8/SJIS/EUC-JP/auto）。exports: `FileEncoding`, `decodeArrayBuffer`。
- `src/file/decode.test.ts` `decodeArrayBuffer` のユニットテスト。
- `src/file/fileOrder.ts` 複数ファイル読み込み時の順序調整（cshtml.cs → cshtml）。export: `reorderRazorPairs`。
- `src/file/fileOrder.test.ts` cshtml ペア順序のテスト。
- `src/file/decodedFiles.ts` rawBytes から連結テキスト/セグメントを生成（最終ファイルの末尾改行は保持し、行番号がモデル行数と一致するよう整合）。exports: `FileBytes`, `DecodedFilesResult`, `buildDecodedFiles`。
- `src/file/decodedFiles.test.ts` 再デコード/セグメント生成のテスト。
- `src/file/lineNumbering.ts` file-local 行番号フォーマット/取得ユーティリティ。exports: `LineSegment`, `LineSegmentInfo`, `getLineSegment`, `getLineSegmentInfo`, `createLineNumberFormatter`。
- `src/file/lineNumbering.test.ts` 行番号計算のテスト。
- `src/file/segmentAppend.ts` 追加入力時の末尾改行の扱いを正規化。export: `normalizeLastSegmentForAppend`。
- `src/file/segmentAppend.test.ts` 末尾改行の正規化テスト。
- `src/file/segmentIndex.ts` 連結セグメントから「ファイル名 → 先頭行/セグメント/グローバル行」を解決。exports: `buildFileStartLineIndex`, `getFileStartLine`, `getFileSegment`, `getGlobalLineFromLocal`。
- `src/file/segmentIndex.test.ts` ファイル先頭行インデックスのテスト。
- `src/file/loadMessages.ts` 読み込み完了メッセージの整形（ファイル名列挙）。exports: `formatLoadSuccessLabel`, `listLoadedFileNames`。
- `src/file/loadMessages.test.ts` メッセージ生成のテスト。
- `src/file/loadErrors.ts` 読み込みエラー整形とログ判定。exports: `isInitializationReferenceError`, `formatFileLoadError`, `shouldLogFileLoadError`。
- `src/file/loadErrors.test.ts` エラー整形のテスト。
- `src/file/postLoad.ts` 読み込み後タスクの安全実行（例外吸収）。export: `runPostLoadTasks`。
- `src/file/postLoad.test.ts` post-load 実行のテスト。
- `src/file/language.ts` ファイル名から Monaco の言語IDを推定し、ペイン単位の言語を決定。exports: `detectLanguageFromFileName`, `inferPaneLanguage`。
- `src/file/language.test.ts` 拡張子→言語推定のテスト。
- `src/file/writeback.ts` File System Access API 経由の読み取り/保存ハンドル取得、再読み込み、文字コード/改行/BOMを維持した単一/複数ファイル書き戻しを担当。exports: `pickFilesWithHandles`, `collectDroppedFiles`, `getPaneWriteAvailability`, `readCurrentFileFromPaneTarget`, `saveTextWithPaneTarget` ほか。
- `src/file/writeback.test.ts` 保存可否、読み取り専用ハンドルでの再読み込み、UTF-8/Shift_JIS/EUC-JP の安全な書き戻し、破損防止のテスト。
- `src/file/multiFileEditModel.ts` 連結表示された複数ファイルの境界判定、ファイル別テキスト抽出、複数ファイル保存の事前エンコード検証を担当。exports: `areChangesWithinSingleFileSegments`, `extractSegmentTexts`, `buildMultiFileWritePlan`。
- `src/file/multiFileEditModel.test.ts` 境界をまたぐ編集の拒否、ファイル別抽出、保存前エンコード検証のテスト。

### src/ui/

- `src/ui/template.ts` アプリの HTML テンプレート定義。保存あり/保存なし画面のテンプレート切替を含む。exports: `createAppTemplate`, `APP_TEMPLATE`。
- `src/ui/template.test.ts` テンプレート内の UI 配置テスト。
- `src/ui/paneClear.ts` ペイン別クリアボタンのバインド。exports: `clearPaneState`, `bindPaneClearButton`。
- `src/ui/paneClear.test.ts` クリア挙動のテスト。
- `src/ui/paneMessages.ts` ペインの読み込み/エラーメッセージ制御と左右高さ同期。exports: `setPaneMessage`, `clearPaneMessage`, `syncPaneMessages`。
- `src/ui/paneMessages.test.ts` メッセージ制御のテスト。
- `src/ui/paneSourceCopy.ts` 各ペインの「コピー」向けに表示行（仮想行含む）を文字列化し、コピー処理を接続。exports: `buildCopyVisualRowsFromAlignedDiff`, `buildCopyTextFromVisualRows`, `bindPaneSourceCopyButton`。
- `src/ui/paneSourceCopy.test.ts` コピー用表示行とボタン接続のテスト。
- `src/ui/diffReport.ts` 表示行（仮想行含む）から左右2列のHTMLレポートを生成し、ダウンロード処理を接続。exports: `buildDiffReportHtml`, `downloadDiffReportHtml`, `bindExportReportButton`。
- `src/ui/diffReport.test.ts` レポートHTML生成・ダウンロード接続のテスト。
- `src/ui/fileCards.ts` ファイル一覧カードの描画と左右高さ同期。exports: `renderFileCards`, `syncFileCards`。
- `src/ui/fileCards.test.ts` カード描画のテスト。
- `src/ui/fileCardJump.ts` ファイルカードクリックのハンドラ接続。export: `bindFileCardJump`。
- `src/ui/fileCardJump.test.ts` カードクリックハンドラのテスト。
- `src/ui/editorFind.ts` Ctrl/Cmd+F をフォーカスペインへ誘導。exports: `handleFindShortcut` と関連型。
- `src/ui/editorFind.test.ts` Find ショートカットのテスト。
- `src/ui/goToLine.ts` Ctrl/Cmd+G のファイル単位行ジャンプUIを開くショートカット判定。export: `handleGoToLineShortcut`。
- `src/ui/goToLine.test.ts` Ctrl/Cmd+G ショートカットのテスト。
- `src/ui/wordWrapToggle.ts` 折り返しの適用処理（UIトグル用、現在は未配線）。export: `bindWordWrapToggle`。
- `src/ui/wordWrapToggle.test.ts` 折り返し切替のテスト。
- `src/ui/wordWrapShortcut.ts` Alt+Z の折り返しショートカット（UI無しの操作経路）。export: `bindWordWrapShortcut`。
- `src/ui/wordWrapShortcut.test.ts` Alt+Z ショートカットのテスト。
- `src/ui/syntaxHighlightToggle.ts` シンタックスハイライトの ON/OFF を切替。export: `bindSyntaxHighlightToggle`。
- `src/ui/syntaxHighlightToggle.test.ts` ハイライト切替のテスト。

## doc/

- `doc/manual.md` テキスト版の利用マニュアル（Windows前提の操作一覧）。
- `doc/MANUAL.html` 画像付きの操作マニュアル（単一HTML）。`scripts/build-manual-html.mjs` でスクリーンショット data URL を更新する。
- `doc/manual-assets/` MANUAL.html 生成用のスクリーンショット素材。

## text/

- `text/README.md` コードリーディング教材の入口（読み順）。
- `text/01_overview.md` 全体像の解説。
- `text/02_entry_and_boot.md` 起動〜初期化の流れ。
- `text/03_ui_architecture.md` UI構造とイベントの解説。
- `text/04_diff_pipeline.md` 差分計算パイプラインの解説。
- `text/05_monaco_integration.md` Monaco連携の解説。
- `text/06_state_and_storage.md` 状態管理と永続化の解説。
- `text/07_testing_strategy.md` テスト戦略の解説。
- `text/08_typical_changes.md` よくある変更の当たり。
- `text/glossary.md` 用語集。

## scripts/

- `scripts/capture-manual-screenshots.mjs` Playwrightでマニュアル用スクショを取得。
- `scripts/build-manual-html.mjs` 現行 MANUAL.html の画像だけを manual-assets から data URL へ差し替える。
- `scripts/embed-manual-html.mjs` `doc/MANUAL.html` を配布HTML内の inert なテキスト領域へ埋め込む。
- `scripts/generate-embedded-wasm.mjs` Rust/WASM 差分エンジンをビルドし、埋め込み TS モジュールを再生成する。
- `scripts/perf-compare.mjs` perf capture JSON の比較と差分表示を行う。

### src/ui/ 続き

- `src/ui/editorOptions.ts` Monaco エディタ生成用の共通オプション（sticky scroll 無効化含む）。export: `createEditorOptions`。
- `src/ui/editorOptions.test.ts` エディタ生成オプションのテスト。
- `src/ui/themeToggle.ts` ☀️/🌙 テーマ切替と保存。exports: `setupThemeToggle`, `ThemeMode`。
- `src/ui/themeToggle.test.ts` テーマ切替のテスト。
- `src/ui/terminalPlugTheme.ts` 非公開Vimモード専用の Monaco テーマ定義とテーマ切替ロック。exports: `defineTerminalPlugTheme`, `applyTerminalPlugThemeLock`, `TERMINAL_PLUG_THEME`。
- `src/ui/terminalPlugTheme.test.ts` Terminal Plug テーマとテーマ切替ロックのテスト。
- `src/ui/toast.ts` トースト通知（成功/失敗メッセージ）の管理。export: `createToastManager`。
- `src/ui/toast.test.ts` トースト通知のテスト。
- `src/ui/diffJumpButtons.ts` 差分ジャンプボタンの有効/無効制御。export: `updateDiffJumpButtons`。
- `src/ui/diffJumpButtons.test.ts` 差分ジャンプのテスト。
- `src/ui/favoritePanel.ts` パス登録ポップオーバーの開閉制御。export: `createFavoritePanelController`。
- `src/ui/favoritePanel.test.ts` パス登録パネル開閉のテスト。
- `src/ui/workspacePanel.ts` ワークスペースUIパネルの開閉制御。export: `createWorkspacePanelController`。
- `src/ui/workspacePanel.test.ts` ワークスペースパネル開閉のテスト。
- `src/ui/workspaceShortcut.ts` Alt+N のトグルショートカット判定。export: `handleWorkspaceShortcut`。
- `src/ui/workspaceShortcut.test.ts` ワークスペースショートカットのテスト。
- `src/ui/themeShortcut.ts` Alt+T のテーマトグルショートカット判定。export: `handleThemeShortcut`。
- `src/ui/themeShortcut.test.ts` テーマショートカットのテスト。
- `src/ui/highlightShortcut.ts` Alt+H のハイライトトグルショートカット判定。export: `handleHighlightShortcut`。
- `src/ui/highlightShortcut.test.ts` ハイライトショートカットのテスト。
- `src/ui/fileOpenShortcut.ts` Ctrl+U のファイル選択ショートカット判定。export: `handleFileOpenShortcut`。
- `src/ui/fileOpenShortcut.test.ts` ファイル選択ショートカットのテスト。
- `src/ui/paneClearShortcut.ts` Ctrl+I / Ctrl+Shift+I のクリアショートカット判定。export: `handlePaneClearShortcut`。
- `src/ui/paneClearShortcut.test.ts` クリアショートカットのテスト。
- `src/ui/vimPlugShortcut.ts` 非公開VimモードのURL切替ショートカット判定。export: `bindVimPlugShortcut`, `handleVimPlugShortcut`。
- `src/ui/vimPaneNavigation.ts` 非公開Vimモード中の `Ctrl+w h/l` ペイン移動と既存ショートカット抑止判定。exports: `handleVimPaneNavigation`, `shouldLetVimHandleEditorKey`。
- `src/ui/vimPlugMode.ts` 非公開Vimモードの Monaco 接続、`:w`/`:wa`/`gd` コマンド接続、status bar ノード生成。
- `src/ui/vimCommands.ts` monaco-vim へのアプリ固有コマンド登録。export: `registerVimPlugCommands`。
- `src/ui/vimDefinition.ts` `gd` 用の軽量な定義候補探索とジャンプ補助。exports: `findDefinitionLine`, `goToLikelyDefinition`。
- `src/ui/workspaceNavigation.ts` ワークスペース一覧の↑/↓移動ロジック。exports: `handleWorkspaceNavigation`, `getNextWorkspaceId`。
- `src/ui/workspaceNavigation.test.ts` ワークスペースナビゲーションのテスト。
- `src/ui/workspaceContent.ts` ワークスペース切替時のエディタ内容保存/復元を補助する。exports: `applyWorkspaceSwitch`, `applyWorkspaceSwitchWithHooks`。
- `src/ui/workspaceContent.test.ts` ワークスペース切替のテキスト保存/復元とフック順序のテスト。
- `src/ui/workspaceSwitchFlow.ts` ワークスペース切替の一連フロー（保存→復元→フック）をまとめる。export: `runWorkspaceSwitch`。
- `src/ui/workspaceSwitchFlow.test.ts` 切替フローの順序とアンカー分離のテスト。
- `src/ui/workspacePaneState.ts` ワークスペース用のペインスナップショット収集/適用（テキスト/segments/選択/カーソル/スクロール）。exports: `collectPaneSnapshot`, `applyPaneSnapshot`。
- `src/ui/workspacePaneState.test.ts` ペインスナップショットの収集/復元テスト。
- `src/ui/workspaceTitle.ts` ワークスペース名からタイトル表示文字列を決定する。export: `getWorkspaceTitle`。
- `src/ui/workspaceTitle.test.ts` タイトル表示のテスト。
- `src/ui/workspaces.ts` ワークスペース一覧の描画と操作抽出（クリック/ドラッグ）。永続化は担当しない。exports: `renderWorkspaces`, `getWorkspaceAction`, `bindWorkspaceDragHandlers`。
- `src/ui/workspaces.test.ts` ワークスペースUIのテスト。
- `src/ui/workspaceRemoval.ts` ワークスペース削除の確認と削除実行。export: `removeWorkspaceWithConfirm`。
- `src/ui/workspaceRemoval.test.ts` 削除確認のテスト。
- `src/ui/favoritePanelShortcut.ts` Ctrl/Cmd+P の開閉トグル判定。export: `handleFavoritePanelShortcut`。
- `src/ui/favoritePanelShortcut.test.ts` パス登録UIトグルのテスト。
- `src/ui/favoritePanelKeyRouting.ts` パス登録UI表示中の文字入力フォーカス制御。exports: `shouldFocusFavoriteInput`, `focusFavoriteInputOnKey`。
- `src/ui/favoritePanelKeyRouting.test.ts` 入力フォーカスルーティングのテスト。
- `src/ui/favoritePaths.ts` 登録パス一覧の描画と操作抽出（クリック/ドラッグ）。永続化は担当しない。exports: `renderFavoritePaths`, `bindFavoritePathHandlers`, `bindFavoritePathDragHandlers` ほか。
- `src/ui/favoritePaths.test.ts` 登録パスUIのテスト。
- `src/ui/favoriteCopy.ts` パスコピーの成功/失敗通知とクローズ連携。export: `copyFavoritePath`。
- `src/ui/favoriteCopy.test.ts` パスコピー成功/失敗のテスト。
- `src/ui/favoritePathNavigation.ts` パス一覧のキーボード選択制御。exports: `moveFavoriteFocusIndex`, `handleFavoriteListKeydown` ほか。
- `src/ui/favoritePathNavigation.test.ts` パス一覧ナビゲーションのテスト。
- `src/ui/anchorPanelToggle.ts` アンカーパネル折りたたみ制御。exports: `setupAnchorPanelToggle`, `setAnchorPanelCollapsed`。
- `src/ui/anchorPanelToggle.test.ts` 折りたたみ UI のテスト。
- `src/ui/anchorClick.ts` 行クリックでのアンカー追加/解除ロジック。exports: `handleLeftAnchorClick`, `handleRightAnchorClick` と関連型。
- `src/ui/anchorClick.test.ts` アンカー操作のテスト。
- `src/ui/anchorDecorations.ts` アンカー装飾（行ハイライト/丸マーカー）生成。export: `buildAnchorDecorations` と関連型。
- `src/ui/anchorDecorations.test.ts` アンカー装飾のテスト。
- `src/ui/anchorNavigation.ts` アンカー一覧の↑/↓移動ロジック。exports: `getNextAnchorKey`, `resolveAnchorMoveDelta`。
- `src/ui/anchorNavigation.test.ts` アンカーナビゲーションのテスト。
- `src/ui/anchorReset.ts` クリア時のアンカー状態/装飾を一括リセット。export: `resetAllAnchors` と関連型。
- `src/ui/anchorReset.test.ts` アンカーリセットのテスト。
- `src/ui/fileBoundaryZones.ts` ファイル境界の表示ゾーン生成（差分行と整列）。exports: `buildAlignedFileBoundaryZones` と関連型。
- `src/ui/fileBoundaryZones.test.ts` 境界ゾーンのテスト。
- `src/ui/recalcScheduler.ts` 差分再計算のデバウンス/重複実行抑止スケジューラ。export: `createRecalcScheduler`。
- `src/ui/recalcScheduler.test.ts` 再計算スケジューラのテスト。
- `src/ui/layoutRecalcWatcher.ts` Monaco のレイアウト/コンテンツサイズ変化を監視し再計算をスケジュール。export: `bindEditorLayoutRecalc`。
- `src/ui/layoutRecalcWatcher.test.ts` レイアウト監視のテスト。
- `src/ui/findWidgetOffset.ts` Find Widget 表示時の左右レイアウト差を検知し、オフセット用 viewZone を生成。
- `src/ui/findWidgetOffset.test.ts` Find Widget オフセット生成のテスト。

### src/storage/

- `src/storage/favoritePaths.ts` パス登録の永続化（左右別 + ワークスペース別キー・上限10件・ロード時補正・旧キー移行）。exports: `loadFavoritePaths`, `addFavoritePath`, `removeFavoritePath`, `moveFavoritePath` ほか。
- `src/storage/favoritePaths.test.ts` パス登録保存のテスト。
- `src/storage/workspaces.ts` ワークスペースの永続化（一覧/順序/選択・上限10件・名前25文字・左右テキスト/segments/選択/カーソル/スクロール・アンカー状態）。本文は IndexedDB を主ストアとし、小さい本文は localStorage に復元用フォールバックも残す。exports: `loadWorkspaces`, `createWorkspace`, `renameWorkspace`, `deleteWorkspace`, `reorderWorkspaces`, `selectWorkspace`, `setWorkspaceTexts`, `setWorkspacePaneState`, `setWorkspaceAnchors`。
- `src/storage/workspaces.test.ts` ワークスペース保存のテスト。
- `src/storage/persistedState.ts` UI状態の localStorage 保存/復元と本文の IndexedDB 保存、復元用フォールバック、スケジューラ。exports: `STORAGE_KEY`, `STORAGE_VERSION`, `loadPersistedState`, `savePersistedState`, `clearPersistedState`, `createPersistScheduler`。
- `src/storage/persistedState.test.ts` 永続化のテスト。
- `src/storage/paneSaveTargets.ts` 再読み込み/保存用ハンドルをワークスペース/ペイン別に IndexedDB 保存する。単一/複数ファイルに対応。exports: `loadPaneSaveTargets`, `savePaneSaveTargets`, `clearPaneSaveTarget`, `createIndexedDbPaneSaveTargetStore`。
- `src/storage/paneSaveTargets.test.ts` ペイン再読み込み/保存用ハンドルの保存/復元/削除テスト。
- `src/storage/paneSummary.ts` 読み込み完了サマリの保存/復元。exports: `loadPaneSummary`, `savePaneSummary`, `clearPaneSummary`。
- `src/storage/paneSummary.test.ts` サマリ保存/復元のテスト。

### src/scrollSync/

- `src/scrollSync/ScrollSyncController.ts` 左右スクロール連動の制御クラス。exports: `ScrollSyncController` と関連型。
- `src/scrollSync/ScrollSyncController.test.ts` スクロール連動のテスト。

### src/perf/

- `src/perf/runtimePerf.ts` runtime perf 記録と `window.__diffViewerPerf` 公開を担当。exports: `recordPerfEvent`, `getPerfSnapshot`, `setEnginePerfStatus` ほか。
- `src/perf/runtimePerf.test.ts` perf snapshot 記録のテスト。

### src/monaco/

- `src/monaco/monacoWorkers.ts` Monaco worker の URL 設定（単体 HTML 向け）。export: `setupMonacoWorkers`。
- `src/monaco/basicLanguages.ts` Monarch 言語定義を直接登録する薄いラッパー。export: `registerBasicLanguages`。

### src/types/

- `src/types/monaco-editor-api.d.ts` Monaco API の型補助（`monaco` 型の最小サポート）。

## rust/

- `rust/diff-engine-wasm/` 埋め込み用 Rust/WASM 差分エンジン。
- `rust/diff-engine-wasm/src/lib.rs` line diff / inline diff / batch diff の export とメモリ境界を管理。
- `rust/diff-engine-wasm/src/diff_steps.rs` 行差分コアのステップ計算を担当。
- `rust/diff-engine-wasm/src/inline_diff.rs` 行内差分コアと batched request 処理を担当。
