# 04. 差分計算パイプライン（Diff Pipeline）

この章で理解できること
- 差分計算がどう組み立てられているか
- 行内差分と行対応の関係
- diffEngine が UI から独立している理由

## 差分計算の入口
- 差分ロジックは `src/diffEngine/` に集約
- UI からは `src/main.ts` が `diffLines` / `pairReplace` / `diffWithAnchors` を呼ぶ

## パイプライン図
```mermaid
flowchart LR
  A[入力テキスト] --> B[normalizeText]
  B --> C[diffLines]
  C --> D[pairReplace]
  D --> E[diffWithAnchors]
  E --> F[PairedOp 配列]
  F --> G[行内差分 diffInline]
  G --> H[Decoration/ViewZone]
```

## 主なファイル
- `src/diffEngine/normalize.ts`: 改行正規化（CRLF → LF）
- `src/diffEngine/diffLines.ts`: 行レベル差分（Patience + Myers）
- `src/diffEngine/pairReplace.ts`: delete/insert を replace にペアリング
- `src/diffEngine/anchors.ts`: 手動アンカー反映と整合性チェック
- `src/diffEngine/diffInline.ts`: 行内差分（インラインハイライト）

## TypeScript 初心者向けポイント
- **純粋関数**が中心（入力→出力だけ）なのでテストしやすい
- `type` 定義（`src/diffEngine/types.ts`）でデータ構造を固定している

初心者が詰まりがちなポイント
- `PairedOp` の `leftLineNo` / `rightLineNo` は 0-based
- `diffInline` は文字列の差分範囲を返す（描画は UI 側）

次に読む: `text/05_monaco_integration.md`
