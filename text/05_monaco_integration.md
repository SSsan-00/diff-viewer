# 05. Monaco連携（モデル/装飾/スクロール）

この章で理解できること
- Monaco Editor の役割と使い方
- 装飾（decoration）と viewZone の違い
- スクロール同期と折り返しの扱い

## Monacoのセットアップ
- Worker 設定: `src/monaco/monacoWorkers.ts` の `setupMonacoWorkers`
- 言語登録: `src/monaco/basicLanguages.ts` の `registerBasicLanguages`
- エディタオプション: `src/ui/editorOptions.ts` の `createEditorOptions`

## 表示の仕組み
- 差分行は decoration で塗り分ける
  - `src/main.ts` の `buildDecorations` → `deltaDecorations`
- 高さ補償や境界表示は viewZone で行う
  - `src/ui/viewZones.ts` の `applyZones`
  - ファイル境界: `src/ui/fileBoundaryZones.ts`
  - Findウィジェット: `src/ui/findWidgetOffset.ts`

## スクロール同期
- `src/scrollSync/ScrollSyncController.ts` が同期を担当
- UI側の同期ON/OFFは `src/main.ts` で配線

## TypeScript 初心者向けポイント
- Monaco の型は `monaco.editor.IStandaloneCodeEditor`
- `deltaDecorations` は「前の装飾ID配列」を返すので差し替えが必要

初心者が詰まりがちなポイント
- viewZone は **行番号ではなくピクセル高さ**で見た目が変わる
- `getTopForLineNumber` は 1-based なので 0-based 行番号から変換する

次に読む: `text/06_state_and_storage.md`
