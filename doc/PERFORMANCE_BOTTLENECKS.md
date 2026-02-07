# PERFORMANCE_BOTTLENECKS

## 概要
- 本ドキュメントは `diff-viewer` のパフォーマンス調査結果をまとめたもの。
- 本調査では**修正は行っていない**（アプリ挙動を変える変更なし）。
- 方針:
  - 推測で断定しない
  - 実測値（CPU profile / Heap / JS heap metrics）を根拠に記述
  - 改善案は「未実装の方向性」に限定

## 調査環境
- OS: macOS 26.2 (Build 25C56)
- Browser: Google Chrome 144.0.7559.133 (Headless, CDP)
- Node: `v22.13.0`
- pnpm: `10.22.0`
- Repo commit: `308b0f5ba1e89d43a29b2c6dddf2777be5dba064`
- App 起動: `pnpm run dev --host 127.0.0.1 --port 4173`

## 調査対象操作
- 差分再計算（`#recalc` ボタン）
- ワークスペース切替（workspace パネルで別 workspace を選択）
- スクロール（左ペインの連続スクロール操作）
- 大きめ入力でのメモリ挙動

### 再現データ
- 左右それぞれ約 6,500 行のテキストを生成して投入（`/tmp/diff_left_large.txt`, `/tmp/diff_right_large.txt`）
- 右側は一部行を意図的に変更して差分が多く出る条件にした

## 関連モジュール / ファイルマップ
### 差分計算・対応付け
- `src/diffEngine/diffLines.ts`
- `src/diffEngine/pairReplace.ts`
- `src/diffEngine/lineSimilarity.ts`
- `src/diffEngine/diffInline.ts`
- `src/diffEngine/htmlAttributeSpaceDiff.ts`
- `src/diffEngine/diffBlocks.ts`
- `src/diffEngine/folding.ts`
- `src/diffEngine/anchors.ts`

### UI統合・再計算実行
- `src/main.ts`（`recalcDiff`, `buildDecorations`, `applyViewZones`, workspace 切替処理）
- `src/ui/recalcScheduler.ts`
- `src/ui/workspaceSwitchFlow.ts`
- `src/ui/workspaceContent.ts`
- `src/ui/workspacePaneState.ts`
- `src/ui/fileBoundaryZones.ts`
- `src/ui/anchorDecorations.ts`

### スクロール連動
- `src/scrollSync/ScrollSyncController.ts`

### 永続化 / 状態保存
- `src/storage/workspaces.ts`
- `src/storage/persistedState.ts`
- `src/storage/paneSummary.ts`

## 計測方法
## 1. CPU（Call tree）
- Chrome DevTools Protocol の `Profiler.start/stop` で操作単位に CPU profile を取得
- 操作前後を固定待機し、各操作の wall time と top self 関数を採取

## 2. Memory
- `Performance.getMetrics` の `JSHeapUsedSize / JSHeapTotalSize` を時点計測
- `HeapProfiler.startSampling/stopSampling` で allocation hotspot を取得

## 3. 操作自動化
- CDP の `DOM.setFileInputFiles` で左右ファイル入力へ大規模データを投入
- UI 操作は `Runtime.evaluate`（ボタンクリック）で実行

補足:
- 対話 GUI の DevTools を直接開く代わりに、同等情報を CDP で採取
- 調査用スクリプトは `/tmp/*.mjs` に作成（repo 配下に変更なし）

## 実測結果
## A. 大きめ入力での差分再計算（必須項目 a）
- 条件: 左右 6,500 行, `#recalc` 実行
- wall time: **2822.179 ms**
- top self（抜粋）:
  - `buildLcsTable` (`src/diffEngine/diffInline.ts`): **13.845 ms self**
  - `extractLineKey` (`src/diffEngine/lineSignature.ts`): **8.793 ms self**
  - `buildLineFeatures` (`src/diffEngine/lineSimilarity.ts`): **6.309 ms self**
  - `buildCompareLines` (`src/diffEngine/diffLines.ts`): **4.991 ms self**
  - `_deltaDecorationsImpl` (Monaco): **2.511 ms self**

観測:
- self time 上位は `diffEngine` 群が支配的
- DOM/Monaco 側では decorations 適用処理が継続的に出現

## B. ワークスペース切替（必須項目 b）
- 条件: workspace 追加後に切替
- wall time: **2699.982 ms**
- top self（抜粋）:
  - `buildLcsTable` (`src/diffEngine/diffInline.ts`): **16.305 / 15.121 ms self**
  - `extractLineKey` (`src/diffEngine/lineSignature.ts`): **8.785 / 7.983 ms self**
  - `parseList` (Monaco runtime): **5.511 ms self, 34.075 ms total**
  - `focus` (native): **7.615 ms self**

観測:
- 切替処理でも `recalcDiff` 相当の重い再計算が発生し、差分計算系が主要コスト
- workspace 保存系（`saveWorkspaces`）も観測されるが、支配的ではない

## C. スクロール（必須項目 c）
- 実測 1: 連続 wheel 注入 220 回
  - wall time: **9558.23 ms**
  - CPU profile は JS hotspot がほぼ出ず、`(root)` 優勢
- 実測 2: スクロール試行中に取得した別プロファイル
  - 長い main-thread ブロック（約 **43.9 s**）が発生
  - top self が `pairReplace` / `scoreLinePair` / `buildCandidates` に集中

観測:
- スクロール単体より、**同時発生する差分再計算（main thread 占有）**がフレーム落ち要因
- `ScrollSyncController` 自体は軽量だが、連動で両ペイン描画負荷が増える構造

## D. メモリ（必須項目 d）
- 時点計測（同一セッション）:
  - 初期: used **19.1 MB**, total **26.4 MB**
  - 大規模ファイルロード後: used **1472.2 MB**, total **1815.1 MB**
  - 再計算後: used **1769.2 MB**, total **1835.3 MB**
  - GC 後 (`HeapProfiler.collectGarbage`): used **23.7 MB**, total **25.6 MB**
- Heap sampling top self allocations（抜粋）:
  - `_deltaDecorationsImpl` (Monaco): **1,248,156 bytes**
  - `_addZone` (Monaco): **397,992 bytes**
  - `pairReplace` (`src/diffEngine/pairReplace.ts`): **131,136 bytes**
  - `detectCategory` (`src/diffEngine/lineSimilarity.ts`): **81,168 bytes**

観測:
- 一時オブジェクト（decorations / zones / diff 中間配列）の生成が大きい
- 恒久リークというより、**ピークが高く GC で大きく回収**されるパターン

## ボトルネック候補 Top N（根拠付き）
1. `diffInline` の LCS テーブル構築
- 操作: 再計算 / ワークスペース切替
- 支配関数: `buildLcsTable` (`src/diffEngine/diffInline.ts`)
- 根拠: self time 上位に連続して出現
- 改善方向（未実装）: 行長閾値で簡易比較へフォールバック、同一行再利用キャッシュ

2. `pairReplace` の候補生成とスコアリング
- 操作: 再計算（特に差分が多いケース）
- 支配関数: `buildCandidates`, `scoreLinePair`, `pairBlock` (`src/diffEngine/pairReplace.ts`, `src/diffEngine/lineSimilarity.ts`)
- 根拠: 別計測で self/total ともに支配
- 改善方向（未実装）: 候補窓幅動的化、トークン索引の再利用、スコア計算の早期打ち切り

3. 行キー抽出の反復実行
- 操作: 再計算 / 切替
- 支配関数: `extractLineKey` (`src/diffEngine/lineSignature.ts`)
- 根拠: top self 常連
- 改善方向（未実装）: 正規化済み行キーのメモ化（テキスト差分単位で無効化）

4. Monaco decorations / zones 適用
- 操作: 再計算後の描画反映
- 支配関数: `_deltaDecorationsImpl`, `_addZone` (Monaco runtime), `applyViewZones` (`src/main.ts`)
- 根拠: heap allocation hotspot と CPU profile の双方で確認
- 改善方向（未実装）: decoration 差分適用、zone 再構築の抑制、更新バッチの見直し

5. ワークスペース切替時の「復元 + 即再計算」の同時実行
- 操作: workspace 切替
- 支配箇所: `runWorkspaceSwitch` → `recalcScheduler.runNow` (`src/main.ts`, `src/ui/workspaceSwitchFlow.ts`)
- 根拠: 切替でも diffEngine 系コストが再現
- 改善方向（未実装）: 復元直後の再計算トリガを条件化（変更差分がある場合のみ）

## 計測計画（Instrumentation 計画）
以下は「実装するなら入れる場所」の具体案（今回は未実装）。

- `src/main.ts:recalcDiff`
  - `performance.mark/measure`:
    - `validateAnchors`
    - `diffLines/pairReplace or diffWithAnchors`
    - `buildDecorations`
    - `deltaDecorations`
    - `applyViewZones`
    - `applyFolding`
- `src/diffEngine/pairReplace.ts`
  - `buildCandidates`, `pairBlock`, `sortCandidates` の所要時間と候補数
- `src/diffEngine/diffInline.ts`
  - `buildLcsTable` の行長・実行回数
- `src/ui/workspaceSwitchFlow.ts` / `src/main.ts` の切替フロー
  - `runWorkspaceSwitch` 全体
  - `onAfterRestore` / `onAfterSwitch` 分離計測
- `src/scrollSync/ScrollSyncController.ts`
  - `handleScroll` 呼び出し回数、1 秒あたりイベント数

ON/OFF 案:
- `localStorage` フラグまたは `import.meta.env.DEV` でのみ有効
- 例: `window.__PERF_TRACE__ === true` のときだけ `measure` 出力

## 変更有無
- repo 内のアプリコードは未変更
- 調査用に `/tmp` 配下へ計測スクリプトを作成して実行
  - 例: `/tmp/perf_probe_ui.mjs`, `/tmp/memory_points.mjs`

## 次のアクション案（修正前に追加で測るべきこと）
1. 実ブラウザ（非 headless）で DevTools Performance を 1 回採取し、`recalcDiff` 区間の long task を確認
2. `recalcDiff` 内部を段階計測して、diff計算 vs decorations適用の比率を定量化
3. 代表データセットを 3 段階（1k/5k/10k 行）で固定し、回帰ベンチを追加
4. workspace 切替時に「差分再計算が本当に必要なケース」の条件計測を先に実施

## 再現可能な比較手順（baseline vs after）
### 1. baseline 側で採取
```sh
pnpm run perf:capture -- --label baseline --runs 3
```

### 2. after 側で採取
```sh
pnpm run perf:capture -- --label after --runs 3
```

### 3. 比較
```sh
pnpm run perf:compare -- perf-results/baseline-<timestamp>.json perf-results/after-<timestamp>.json
```

### 4. 補足
- `perf:capture` は `--auto-dev` を使って dev server を自動起動する。
- 出力は `perf-results/` に JSON で保存される。
- 比較指標は `recalc` / `workspace-switch` の median wall time。
