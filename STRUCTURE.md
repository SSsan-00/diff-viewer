# Repository Structure

目的: ファイル構成の地図。コマンド説明は README に集約する。

```
.
├── AGENTS.md
├── README.md
├── STRUCTURE.md
├── spec.md
├── docs/
│   └── backlog.md
├── dist/
├── scripts/
├── src/
├── public/
├── patches/
├── index.html
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.json
└── vite.config.ts
```

- `AGENTS.md` コントリビュータ向けの作業ガイド。
- `README.md` プロジェクト概要と使用方法。
- `STRUCTURE.md` 本ファイル。構成の目次。
- `spec.md` 仕様の Single Source of Truth。
- `docs/backlog.md` 改善案の待機所。
- `dist/` 配布成果物の出力先（`index.html` / `index.min.html`）。
- `scripts/` 配布物検証・成果物組み立て用の補助スクリプト。
- `src/` TypeScript の実装本体。
- `public/` 公開用の静的リソース置き場。
- `patches/` 依存関係向けのパッチ保管。
- `index.html` 開発用のエントリHTML。
- `package.json` スクリプトと依存関係。
- `pnpm-lock.yaml` pnpm の lockfile。
- `pnpm-workspace.yaml` pnpm ワークスペース設定。
- `tsconfig.json` TypeScript 設定。
- `vite.config.ts` Vite のビルド設定。
