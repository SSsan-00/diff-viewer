export const APP_TEMPLATE = `
  <div class="app">
    <header class="toolbar">
      <div class="toolbar-left">
        <div class="title">Diff Viewer</div>
      </div>
      <div class="toolbar-right">
        <button id="recalc" class="button" type="button">差分再計算</button>
        <button id="diff-prev" class="button" type="button">前の差分</button>
        <button id="diff-next" class="button" type="button">次の差分</button>
        <label class="toggle">
          <input id="sync-toggle" type="checkbox" checked />
          <span>スクロール連動</span>
        </label>
        <label class="toggle">
          <input id="fold-toggle" type="checkbox" />
          <span>差分なしの箇所を折りたたみ</span>
        </label>
        <button id="clear" class="button button-subtle" type="button">クリア</button>
      </div>
    </header>
    <section class="anchor-panel">
      <div class="anchor-header">
        <div class="anchor-title">アンカー</div>
        <div class="anchor-header-right">
          <div id="anchor-message" class="anchor-message" aria-live="polite"></div>
          <button
            id="anchor-toggle"
            class="button button-subtle"
            type="button"
            aria-expanded="true"
            aria-controls="anchor-panel-body"
          >
            折りたたみ
          </button>
        </div>
      </div>
      <div id="anchor-panel-body" class="anchor-panel-body">
        <div id="anchor-warning" class="anchor-warning" aria-live="polite"></div>
        <ul id="anchor-list" class="anchor-list"></ul>
      </div>
    </section>
    <div class="editors">
      <section id="left-pane" class="editor-pane">
        <div class="pane-title">
          <div class="pane-title-left">
            <span>Left</span>
            <div class="file-picker">
              <input id="left-file" class="file-input" type="file" multiple />
              <button id="left-file-button" class="button button-subtle" type="button">
                ファイルを選択
              </button>
              <span class="file-hint">ドラッグ&ドロップ可</span>
            </div>
          </div>
          <div class="pane-actions">
            <button
              id="left-clear"
              class="button button-subtle pane-clear"
              type="button"
              data-testid="left-clear"
              aria-label="左をクリア"
            >
              クリア
            </button>
            <label class="pane-select">
              文字コード
              <select id="left-encoding">
                <option value="auto" selected>自動（BOM/UTF-8/SJIS/EUC）</option>
                <option value="utf-8">UTF-8</option>
                <option value="shift_jis">Shift_JIS</option>
                <option value="euc-jp">EUC-JP</option>
              </select>
            </label>
          </div>
        </div>
        <div id="left-message" class="pane-message" aria-live="polite"></div>
        <div id="left-editor" class="editor"></div>
      </section>
      <section id="right-pane" class="editor-pane">
        <div class="pane-title">
          <div class="pane-title-left">
            <span>Right</span>
            <div class="file-picker">
              <input id="right-file" class="file-input" type="file" multiple />
              <button id="right-file-button" class="button button-subtle" type="button">
                ファイルを選択
              </button>
              <span class="file-hint">ドラッグ&ドロップ可</span>
            </div>
          </div>
          <div class="pane-actions">
            <button
              id="right-clear"
              class="button button-subtle pane-clear"
              type="button"
              data-testid="right-clear"
              aria-label="右をクリア"
            >
              クリア
            </button>
            <label class="pane-select">
              文字コード
              <select id="right-encoding">
                <option value="auto" selected>自動（BOM/UTF-8/SJIS/EUC）</option>
                <option value="utf-8">UTF-8</option>
                <option value="shift_jis">Shift_JIS</option>
                <option value="euc-jp">EUC-JP</option>
              </select>
            </label>
          </div>
        </div>
        <div id="right-message" class="pane-message" aria-live="polite"></div>
        <div id="right-editor" class="editor"></div>
      </section>
    </div>
  </div>
`;
