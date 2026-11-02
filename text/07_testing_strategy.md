# 07. テストの読み方（Testing Strategy）

この章で理解できること
- どの層をどのテストが守っているか
- Vitest の基本的な読み方
- 初心者向けにテストの「入口」を示す

## テストの方針
- テスト基盤は Vitest
- `src/diffEngine/` の純粋関数はユニットテストで固定
- UIはロジックの壊れを前提に、必要最低限をテスト

## 代表的なテスト
- 差分ロジック
  - `src/diffEngine/diffLines.test.ts`
  - `src/diffEngine/pairReplace.test.ts`
  - `src/diffEngine/diffInline.test.ts`
- UIロジック
  - `src/ui/template.test.ts`
  - `src/ui/favoritePaths.test.ts`
  - `src/ui/workspacePanel.test.ts`
- 配布物の検証
  - `scripts/dist-rules.test.ts`
  - `src/distLayout.test.ts`

## TypeScript 初心者向けポイント
- テスト内で `describe` / `it` を読む
- `expect(...).toBe(...)` のようなアサーションに慣れる
- UI系テストは jsdom の制約がある（DOMの見た目検証は避ける）

初心者が詰まりがちなポイント
- テストが失敗した時は「どの入力で壊れたか」を先に読む
- 型エラーは `tsconfig` ではなくテストコード側の `as` が原因のことが多い

次に読む: `text/08_typical_changes.md`

## 検証の重複を避ける

- 配布物の禁止ルールは `scripts/dist-rules.mjs` に集約し、テストと配布前検証で共用する。
- 接続処理はソース文字列の有無ではなく、実際の関数を実行して結果を確認する。`src/testing/mainFunctions.ts` は main の対象関数だけを抽出・実行し、Monaco の全体起動を避ける。
- パラメータ化したケースは入力を実際に変える。ハイライト範囲は具体的な期待位置を使い、空配列同士の比較だけで成功させない。
