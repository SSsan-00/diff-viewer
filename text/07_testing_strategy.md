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
  - `src/distGate.test.ts`
  - `src/distLayout.test.ts`

## TypeScript 初心者向けポイント
- テスト内で `describe` / `it` を読む
- `expect(...).toBe(...)` のようなアサーションに慣れる
- UI系テストは jsdom の制約がある（DOMの見た目検証は避ける）

初心者が詰まりがちなポイント
- テストが失敗した時は「どの入力で壊れたか」を先に読む
- 型エラーは `tsconfig` ではなくテストコード側の `as` が原因のことが多い

次に読む: `text/08_typical_changes.md`
