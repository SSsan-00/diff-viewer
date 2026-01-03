# Diff Viewer

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
