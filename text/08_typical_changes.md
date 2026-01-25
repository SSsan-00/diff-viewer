# 08. よくある変更例（Typical Changes）

この章で理解できること
- 「どこを触ればいいか」の当たり
- UI/差分/保存の変更の入り口
- 初心者向けの安全な進め方

## 1) ショートカットを追加したい
- 配線: `src/main.ts`
- 判定ロジック: `src/ui/*Shortcut.ts`
- テスト: `src/ui/*Shortcut.test.ts`

## 2) UIパネルを追加したい
- DOM構造: `src/ui/template.ts`
- イベント: `src/main.ts` で bind
- スタイル: `src/style.css`

## 3) 差分ロジックを改善したい
- 入口: `src/diffEngine/` の純粋関数
- 行対応やスコアリング: `src/diffEngine/lineSignature.ts` / `src/diffEngine/lineSimilarity.ts`
- 追加テスト: `src/diffEngine/*.test.ts`

## 4) 保存する状態を増やしたい
- 永続化: `src/storage/`
- ワークスペース: `src/storage/workspaces.ts`
- 反映: `src/main.ts` で restore/apply

## TypeScript 初心者向けポイント
- 変更前に型を読むと、編集すべき範囲が見える
- `type` を追加する時は、使う側も合わせて更新する

初心者が詰まりがちなポイント
- 「UI変更だけ」のつもりが `main.ts` に波及しやすい
- localStorage の型が増えると復元時のバリデーションが必要になる

次に読む: `text/glossary.md`
