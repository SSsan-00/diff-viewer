# SETUP

## 前提
- Node.js は本リポジトリ内にバージョン指定がありません。利用環境に合わせてください。
- pnpm は `package.json` の `packageManager` に基づき `pnpm@10.22.0` を利用します。

## 初回セットアップ
```bash
pnpm install
```

## 開発起動
```bash
pnpm run dev
```

## テスト
```bash
pnpm test
```

## ビルド（単体HTML生成）
```bash
pnpm run build:single
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
