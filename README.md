# Diff Viewer

VS Code っぽい差分ビューを **単一HTML** で動かすための実験プロジェクトです。

## Features

- 2ペインの Monaco Editor で差分表示（行/行内ハイライト）
- スクロール連動 ON/OFF
- 差分再計算 / 前後ジャンプ
- アンカー行の追加・削除・ジャンプ
- 差分なし領域の折りたたみ（クリックで展開）
- ファイル読み込み（ドラッグ&ドロップ / ファイル選択）
- 文字コード選択（UTF-8 / Shift_JIS / EUC-JP / 自動）
- クリア（左右の内容とアンカーを全消去）

注意: エディタでの編集はメモリ上のみで、ファイルの保存/上書きは行いません。

## Usage

1) `dist/index.html` を開く  
2) 左右それぞれにファイルを読み込み or テキストを貼り付け  
3) `差分再計算` を押して差分表示  
4) アンカーは左右の行番号を順にクリックして追加（同じ行をクリックすると削除）

## Single-file build (dist/index.html only)

1) Install dependencies:
   - `npm ci`
2) Build a single HTML file:
   - `npm run build:single`
3) Open `dist/index.html` directly (file://).

Verify that these work in the built file:
- Monaco editors render
- Diff recalculation
- Scroll sync ON/OFF
- Next/previous diff jump
- Folding
- File load (drag & drop + file input)
- Shift_JIS / EUC-JP decoding
- Anchors add/remove/jump/decorations
- Clear button resets both editors + anchors
