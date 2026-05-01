# SETUP

## 前提
- Node.js は本リポジトリ内にバージョン指定がありません。利用環境に合わせてください。
- pnpm は `package.json` の `packageManager` に基づき `pnpm@10.22.0` を利用します。
- Rust は任意です。
  - 埋め込み WASM を再生成したい場合、または `pnpm run test:rust` を使う場合は Rust toolchain が必要です。
  - その場合は `wasm32-unknown-unknown` ターゲットも追加してください。

## 初回セットアップ
```bash
pnpm install
```

WASM を手元で再生成する場合:

```bash
rustup target add wasm32-unknown-unknown
```

## 開発起動
```bash
pnpm run dev
```

## テスト
```bash
pnpm test
```

Rust 側のテスト:

```bash
pnpm run test:rust
```

## ビルド（単体HTML生成）
```bash
pnpm run build:single
```

埋め込み WASM だけ更新したい場合:

```bash
pnpm run wasm:embed
```

## 成果物検証
```bash
pnpm run verify:dist
```

## よくある詰まり
- **禁止文字列ゲート**: `dist/index.html` / `dist/index.min.html` に禁止文字列が混入すると `verify:dist` が失敗します。ビルド結果を必ず再確認してください。
- **file:// 直開き確認**: `dist/index.html` / `dist/index.min.html` を `file://` で開き、主要UIが崩れないことを確認します。
- **dev/preview が EPERM**: 環境によっては `pnpm dev` / `pnpm preview` が権限エラーで起動できません。その場合は `pnpm build` 後に `dist/index.html` を `file://` 直開きで確認します。
- **DevTools の拡張エラー**: アプリ外の拡張が DevTools にエラーを出す場合があります。シークレットモードや拡張OFFで再確認してください。
- **Rust が無い環境**: `pnpm run build` / `pnpm run build:single` は既存の埋め込み WASM を使うか、必要に応じて TypeScript 実装へフォールバックして続行します。WASM を最新化したい場合だけ Rust を入れてください。
