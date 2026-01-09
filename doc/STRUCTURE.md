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

## src/ 全ファイル一覧（67件）

### src/

- `src/main.ts` アプリ起点。Monaco初期化、イベント配線、差分再計算、アンカー描画、読み込み/保存を統合。
- `src/style.css` 画面全体のレイアウト/配色/差分ハイライト/アンカー/境界表示のスタイル。
- `src/licenses.ts` 依存ライセンス本文のデータ（主に `src/main.ts` から参照）。
- `src/smoke.test.ts` Vitestの起動確認用スモークテスト。
- `src/distGate.test.ts` 配布物ゲート（禁止文字列/SourceMap/modulepreload）の検査テスト。
- `src/distLayout.test.ts` テンプレート構造（ペイン/ツールバー/ドロップUI）の回帰テスト。
- `src/distReadableStyle.test.ts` 可読版/最適化版のCSS一致とデータURL維持のテスト。
- `src/styleFileBoundary.test.ts` ファイル境界CSSが大文字化しないことのテスト。

### src/diffEngine/

- `src/diffEngine/types.ts` 差分モデルの型定義（LineOp/InlineDiff/Rangeなど）。
- `src/diffEngine/normalize.ts` 改行正規化（CRLF/CR → LF）。
- `src/diffEngine/normalize.test.ts` 正規化のユニットテスト。
- `src/diffEngine/lineSignature.ts` 行の識別子抽出（ユニーク行アンカー用）。
- `src/diffEngine/lineSimilarity.ts` 行のトークン化/スコア計算（識別子/リテラル等）。
- `src/diffEngine/diffLines.ts` 行レベル差分（Myers + ユニーク行優先）。
- `src/diffEngine/diffLines.test.ts` 行差分の基本ケーステスト。
- `src/diffEngine/diffLinesAlignment.test.ts` 行対応の安定性テスト。
- `src/diffEngine/diffLinesSemanticAlignment.test.ts` 識別子ベースの対応付けテスト。
- `src/diffEngine/pairReplace.ts` delete/insert を replace にペアリングする補助。
- `src/diffEngine/pairReplace.test.ts` ペアリング挙動のテスト。
- `src/diffEngine/diffInline.ts` 行内差分の算出（LCSベース）。
- `src/diffEngine/diffInline.test.ts` 行内差分のテスト。
- `src/diffEngine/diffBlocks.ts` 行差分を表示用のペア行へ変換する補助。
- `src/diffEngine/diffBlocks.test.ts` ブロック/行マッピングのテスト。
- `src/diffEngine/anchors.ts` アンカー検証・分割差分のロジック。
- `src/diffEngine/anchors.test.ts` アンカー検証のテスト。
- `src/diffEngine/folding.ts` 折りたたみ対象範囲の算出。
- `src/diffEngine/folding.test.ts` 折りたたみ範囲のテスト。

### src/file/

- `src/file/decode.ts` 文字コードデコード（UTF-8/SJIS/EUC-JP/auto）。
- `src/file/decode.test.ts` デコードのユニットテスト。
- `src/file/decodedFiles.ts` rawBytes から連結テキスト/セグメントを生成。
- `src/file/decodedFiles.test.ts` 再デコード/セグメント生成のテスト。
- `src/file/lineNumbering.ts` file-local 行番号フォーマット/取得ユーティリティ。
- `src/file/lineNumbering.test.ts` 行番号計算のテスト。
- `src/file/loadMessages.ts` 読み込み完了メッセージの整形（ファイル名列挙）。
- `src/file/loadMessages.test.ts` メッセージ生成のテスト。
- `src/file/loadErrors.ts` 読み込みエラー整形とログ判定。
- `src/file/loadErrors.test.ts` エラー整形のテスト。
- `src/file/postLoad.ts` 読み込み後タスクの安全実行（例外吸収）。
- `src/file/postLoad.test.ts` post-load 実行のテスト。

### src/ui/

- `src/ui/template.ts` アプリのHTMLテンプレート定義。
- `src/ui/template.test.ts` テンプレート内のUI配置テスト。
- `src/ui/paneClear.ts` ペイン別クリアボタンのバインド。
- `src/ui/paneClear.test.ts` クリア挙動のテスト。
- `src/ui/paneMessages.ts` ペインの読み込み/エラーメッセージ制御。
- `src/ui/paneMessages.test.ts` メッセージ制御のテスト。
- `src/ui/editorFind.ts` Ctrl/Cmd+F をフォーカスペインに誘導。
- `src/ui/editorFind.test.ts` Find ショートカットのテスト。
- `src/ui/wordWrapToggle.ts` ペイン別折り返し切替（rAF後にコールバック）。
- `src/ui/wordWrapToggle.test.ts` 折り返し切替のテスト。
- `src/ui/themeToggle.ts` ☀️/🌙 テーマ切替と保存。
- `src/ui/themeToggle.test.ts` テーマ切替のテスト。
- `src/ui/diffJumpButtons.ts` 差分ジャンプボタンの有効/無効制御。
- `src/ui/diffJumpButtons.test.ts` 差分ジャンプのテスト。
- `src/ui/anchorPanelToggle.ts` アンカーパネル折りたたみ制御。
- `src/ui/anchorPanelToggle.test.ts` 折りたたみUIのテスト。
- `src/ui/anchorClick.ts` 行クリックでのアンカー追加/解除ロジック。
- `src/ui/anchorClick.test.ts` アンカー操作のテスト。
- `src/ui/anchorDecorations.ts` アンカー装飾（行ハイライト/丸マーカー）生成。
- `src/ui/anchorDecorations.test.ts` アンカー装飾のテスト。
- `src/ui/fileBoundaryZones.ts` ファイル境界の表示ゾーン生成（差分行と整列）。
- `src/ui/fileBoundaryZones.test.ts` 境界ゾーンのテスト。

### src/storage/

- `src/storage/persistedState.ts` LocalStorage 保存/復元とスケジューラ。
- `src/storage/persistedState.test.ts` 永続化のテスト。

### src/scrollSync/

- `src/scrollSync/ScrollSyncController.ts` 左右スクロール連動の制御クラス。
- `src/scrollSync/ScrollSyncController.test.ts` スクロール連動のテスト。

### src/monaco/

- `src/monaco/monacoWorkers.ts` Monaco worker のURL設定（単体HTML向け）。

### src/types/

- `src/types/monaco-editor-api.d.ts` Monaco API の型補助。
