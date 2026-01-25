# TypeScriptコードリーディング教材（diff-viewer）

この章で理解できること
- この教材の読み順と目的
- どのファイルを見ながら読むか
- 読者の前提とゴール

## 目的と読者
- 対象: Webアプリは作れるが TypeScript は初心者
- ゴール: `src/` の主要な流れを追い、差分表示まで辿れるようにする

## 読み順
1. `text/01_overview.md`
2. `text/02_entry_and_boot.md`
3. `text/03_ui_architecture.md`
4. `text/04_diff_pipeline.md`
5. `text/05_monaco_integration.md`
6. `text/06_state_and_storage.md`
7. `text/07_testing_strategy.md`
8. `text/08_typical_changes.md`
9. `text/glossary.md`

## 参照する公式ドキュメント
- 仕様の唯一の正: `doc/SPEC.md`
- 構成の地図: `doc/STRUCTURE.md`
- プロジェクト方針: `AGENTS.md`
- 概要と使い方: `README.md`

## 読み方のコツ
- まず `src/main.ts` を入口として「どこが起点か」を把握します
- UIは `src/ui/` に分散しているため、機能ごとに分けて読むと理解しやすいです
- diffエンジンは `src/diffEngine/` に集約されているため、UIと切り離して読めます

## 初心者向け補足
- 各章で TypeScript の書き方も「このリポジトリの具体例」で説明します
- 不明な用語は `text/glossary.md` を参照してください

次に読む: `text/01_overview.md`
