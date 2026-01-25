# 用語集（Glossary）

この章で理解できること
- このリポジトリ固有の用語
- TypeScript 初心者向けの基本用語

## リポジトリ固有の用語
- **左ペイン / 右ペイン**: Monaco Editor の左右2領域
- **アンカー**: 左右の行対応を固定するための基準点（`src/diffEngine/anchors.ts`）
- **PairedOp**: 行対応の結果を表す差分モデル（`src/diffEngine/types.ts`）
- **viewZone**: Monaco に挿入する高さ調整の空白（境界/補償/検索UIなど）
- **segments**: 複数ファイル連結時の境界情報（`src/file/lineNumbering.ts`）
- **workspace**: 作業単位。左右テキスト/アンカー/スクロール位置などを保持

## TypeScript 初心者向け用語
- **型注釈**: `const x: number = 1` の `: number`
- **union型**: `"left" | "right"` のように取り得る値を限定
- **interface / type**: オブジェクト構造を表す定義
- **optional**: `value?: string` で「無い可能性」を示す
- **null / undefined**: 値が無い状態。区別して扱う
- **as**: 型の断定。安全性を落とすので使い所を限定する
- **Record**: `Record<string, unknown>` のような辞書型
- **readonly**: 変更できないことを表す修飾

次に読む: `text/README.md`
