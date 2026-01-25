# 06. 状態と永続化（State & Storage）

この章で理解できること
- 状態がどこで管理されているか
- localStorage に何が保存されるか
- ワークスペース/アンカー/お気に入りパスの関係

## 状態の中心
- 起点: `src/main.ts` が複数の状態を束ねる
- 永続化: `src/storage/` 配下

## ワークスペース
- 定義: `src/storage/workspaces.ts`
- 重要型:
  - `Workspace`: 左右テキスト/segments/カーソル/スクロール/アンカー
  - `WorkspacesState`: 一覧 + 選択ID
- 保存キー: `diffViewer.workspaces`

## アンカー状態
- `WorkspaceAnchorState` に保存される
- auto/manual/pending/selected を分離
- decoration ID は保存しない（再生成）

## お気に入りパス
- `src/storage/favoritePaths.ts` で管理
- ペイン単位、ワークスペース単位で保存

## TypeScript 初心者向けポイント
- `type` と `interface` の使い分け
- `Record<string, unknown>` のような汎用型
- 型ガード（`typeof` / `Array.isArray`）で安全に復元

初心者が詰まりがちなポイント
- localStorage は `string` しか保存できないため、JSON 化が前提
- 復元時に型チェックしないと、実行時エラーにつながる

次に読む: `text/07_testing_strategy.md`
