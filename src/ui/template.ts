export const APP_TEMPLATE = `
  <div class="app">
    <header class="toolbar">
      <div class="toolbar-left">
        <div class="title app-title">Diff Viewer</div>
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
          <input id="highlight-toggle" type="checkbox" checked />
          <span>ハイライト</span>
        </label>
        <label class="toggle">
          <input id="fold-toggle" type="checkbox" aria-label="差分のみ表示" />
          <span>差分のみ表示</span>
        </label>
        <label class="theme-switch">
          <input
            id="theme-toggle"
            type="checkbox"
            role="switch"
            aria-label="テーマ"
            aria-checked="false"
          />
          <span class="theme-switch__track" aria-hidden="true">
            <svg class="theme-switch__cloud theme-switch__cloud--front" viewBox="140 70 120 70" aria-hidden="true">
              <path
                class="theme-switch__cloud-shape"
                d="M153.269,109.614h2.813c-1.348-2.84-2.124-6.003-2.124-9.354c0-12.083,9.794-21.878,21.877-21.878c7.872,0,14.751,4.172,18.605,10.411c2.121-1.246,4.583-1.974,7.221-1.974c7.889,0,14.285,6.396,14.285,14.285c0,2.1-0.465,4.087-1.277,5.882h6.354c6.604,0,12.007,5.403,12.007,12.007s-5.403,12.006-12.007,12.006h-25.151H179.48h-26.212c-5.881,0-10.692-4.812-10.692-10.692S147.388,109.614,153.269,109.614z"
              />
            </svg>
            <svg class="theme-switch__cloud theme-switch__cloud--back" viewBox="140 70 120 70" aria-hidden="true">
              <path
                class="theme-switch__cloud-shape"
                d="M153.269,109.614h2.813c-1.348-2.84-2.124-6.003-2.124-9.354c0-12.083,9.794-21.878,21.877-21.878c7.872,0,14.751,4.172,18.605,10.411c2.121-1.246,4.583-1.974,7.221-1.974c7.889,0,14.285,6.396,14.285,14.285c0,2.1-0.465,4.087-1.277,5.882h6.354c6.604,0,12.007,5.403,12.007,12.007s-5.403,12.006-12.007,12.006h-25.151H179.48h-26.212c-5.881,0-10.692-4.812-10.692-10.692S147.388,109.614,153.269,109.614z"
              />
            </svg>
            <svg class="theme-switch__stars" viewBox="0 0 369 171.667" aria-hidden="true">
              <polygon class="theme-switch__star-shape" points="166.253,132.982 164.364,135.676 160.983,136.488 163.196,138.965 162.996,142.16 166.253,140.998 169.509,142.16 169.309,138.965 171.522,136.488 168.142,135.676" />
              <polygon class="theme-switch__star-shape" points="175.522,44.243 172.684,48.29 167.603,49.51 170.929,53.233 170.628,58.035 175.522,56.288 180.417,58.035 180.116,53.233 183.442,49.51 178.361,48.29" />
              <polygon class="theme-switch__star-shape" points="208.22,91.845 206.083,94.891 202.259,95.81 204.763,98.61 204.535,102.226 208.22,100.911 211.903,102.226 211.677,98.61 214.181,95.81 210.356,94.891" />
              <polygon class="theme-switch__star-shape" points="252.545,39.052 250.409,42.098 246.585,43.017 249.089,45.819 248.86,49.433 252.545,48.118 256.229,49.433 256.002,45.819 258.506,43.017 254.682,42.098" />
              <polygon class="theme-switch__star-shape" points="280.151,84.949 282.749,88.997 287.401,90.217 284.355,93.94 284.632,98.742 280.151,96.995 275.669,98.742 275.946,93.94 272.899,90.217 277.552,88.997" />
              <polygon class="theme-switch__star-shape" points="249.791,124.466 246.668,128.919 241.076,130.261 244.737,134.356 244.405,139.64 249.791,137.718 255.178,139.64 254.845,134.356 258.506,130.261 252.914,128.919" />
            </svg>
            <span class="theme-switch__thumb">
              <svg class="theme-switch__sun" viewBox="180 14 150 150" aria-hidden="true">
                <g id="sun">
                  <path fill="#F4E962" d="M255.661,153.638c-18.113,0-35.144-7.054-47.951-19.862c-12.809-12.808-19.862-29.838-19.862-47.951s7.054-35.144,19.862-47.951c12.808-12.809,29.838-19.862,47.951-19.862c18.114,0,35.144,7.054,47.952,19.862c12.808,12.808,19.861,29.838,19.861,47.951s-7.054,35.144-19.861,47.951C290.805,146.584,273.775,153.638,255.661,153.638z" />
                  <path fill="#F9C941" d="M255.661,21.671c35.431,0,64.153,28.722,64.153,64.153s-28.723,64.153-64.153,64.153s-64.153-28.723-64.153-64.153S220.23,21.671,255.661,21.671 M255.661,14.35c-9.646,0-19.007,1.891-27.823,5.62c-8.512,3.601-16.154,8.753-22.717,15.314c-6.562,6.562-11.714,14.205-15.314,22.717c-3.729,8.816-5.62,18.178-5.62,27.823s1.891,19.007,5.62,27.823c3.601,8.512,8.753,16.155,15.314,22.717c6.563,6.562,14.205,11.714,22.717,15.314c8.816,3.729,18.178,5.62,27.823,5.62s19.007-1.891,27.823-5.62c8.512-3.601,16.155-8.753,22.717-15.314c6.563-6.562,11.715-14.205,15.314-22.717c3.729-8.816,5.62-18.178,5.62-27.823s-1.891-19.007-5.62-27.823c-3.6-8.512-8.752-16.155-15.314-22.717c-6.562-6.562-14.205-11.714-22.717-15.314C274.668,16.241,265.307,14.35,255.661,14.35L255.661,14.35z" />
                </g>
              </svg>
              <svg class="theme-switch__moon" viewBox="180 14 150 150" aria-hidden="true">
                <g id="moon">
                  <path fill="#CAD9DD" d="M255.662,153.639c-18.114,0-35.144-7.055-47.952-19.863c-12.808-12.807-19.861-29.837-19.861-47.951s7.054-35.144,19.861-47.951c12.809-12.809,29.838-19.862,47.952-19.862s35.144,7.054,47.951,19.862c12.809,12.808,19.862,29.838,19.862,47.951s-7.054,35.144-19.862,47.951C290.806,146.584,273.776,153.639,255.662,153.639z" />
                  <path fill="#A2B5BF" d="M255.662,21.672c35.431,0,62.713,28.731,62.713,64.162c0,35.431-27.282,62.167-62.713,62.167s-64.153-26.744-64.153-62.175C191.509,50.394,220.231,21.672,255.662,21.672 M255.662,14.35c-9.646,0-19.007,1.891-27.823,5.62c-8.512,3.6-16.155,8.753-22.717,15.315c-6.563,6.562-11.715,14.204-15.314,22.717c-3.729,8.816-5.62,18.178-5.62,27.823s1.891,19.007,5.62,27.824c3.6,8.512,8.752,16.154,15.314,22.717c6.562,6.561,14.205,11.713,22.717,15.314c8.816,3.729,18.178,5.619,27.823,5.619s19.007-1.891,27.823-5.619c8.512-3.602,16.154-8.754,22.717-15.314c6.562-6.563,11.714-14.205,15.314-22.717c3.729-8.816,5.619-18.178,5.619-27.824s-1.891-19.007-5.619-27.823c-3.601-8.513-8.753-16.155-15.314-22.717c-6.563-6.562-14.205-11.715-22.717-15.315C274.669,16.241,265.308,14.35,255.662,14.35L255.662,14.35z" />
                  <path fill="#A2B5BF" d="M295.264,35.35c8.768,10.972,14.013,24.881,14.013,40.017c0,35.43-28.723,64.153-64.153,64.153c-14.944,0-28.696-5.109-39.602-13.68c11.755,14.711,29.846,24.137,50.141,24.137c35.431,0,64.153-28.721,64.153-64.152C319.815,65.339,310.213,47.096,295.264,35.35z" />
                  <circle fill="#CAD9DD" cx="304.291" cy="98.701" r="5.392" />
                  <path fill="#CAD9DD" d="M278.364,126.115c0-8.791-7.127-15.916-15.918-15.916s-15.918,7.125-15.918,15.916c0,8.793,7.127,15.92,15.918,15.92S278.364,134.908,278.364,126.115z" />
                  <circle fill="#CAD9DD" cx="242.372" cy="138.547" r="3.603" />
                  <circle fill="#CAD9DD" cx="306.504" cy="57.724" r="3.456" />
                  <circle fill="#A2B5BF" cx="262.446" cy="126.115" r="14.346" />
                  <circle fill="#A2B5BF" cx="239.621" cy="65.064" r="9.908" />
                  <circle fill="#A2B5BF" cx="292.418" cy="64.686" r="7.339" />
                  <circle fill="#A2B5BF" cx="285.796" cy="108.111" r="3.48" />
                  <circle fill="#A2B5BF" cx="222.605" cy="77.949" r="4.441" />
                  <circle fill="#A2B5BF" cx="242.372" cy="138.547" r="2.751" />
                  <circle fill="#A2B5BF" cx="238.652" cy="40.059" r="2.751" />
                  <circle fill="#A2B5BF" cx="252.921" cy="44.149" r="5.33" />
                  <circle fill="#A2B5BF" cx="258.251" cy="81.17" r="4.195" />
                  <circle fill="#A2B5BF" cx="306.504" cy="57.724" r="2.751" />
                  <circle fill="#A2B5BF" cx="207.412" cy="62.199" r="2.751" />
                  <circle fill="#A2B5BF" cx="214.279" cy="103.596" r="2.751" />
                </g>
              </svg>
            </span>
          </span>
        </label>
        <button id="clear" class="button button-subtle" type="button">クリア</button>
      </div>
    </header>
    <section class="anchor-panel">
      <div class="anchor-header">
        <div class="anchor-title">アンカー</div>
        <div class="anchor-header-right">
          <div id="anchor-message" class="anchor-message" aria-live="polite"></div>
          <label class="toggle">
            <input id="anchor-toggle" type="checkbox" />
            <span>アンカーを折りたたみ</span>
          </label>
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
              <span class="pane-select-label">文字コード</span>
              <select id="left-encoding">
                <option value="auto" selected>自動（BOM/UTF-8/SJIS/EUC）</option>
                <option value="utf-8">UTF-8</option>
                <option value="shift_jis">Shift_JIS</option>
                <option value="euc-jp">EUC-JP</option>
              </select>
            </label>
          </div>
        </div>
        <div
          id="left-file-cards"
          class="file-cards-bar file-cards-bar--horizontal"
          aria-label="files"
        ></div>
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
              <span class="pane-select-label">文字コード</span>
              <select id="right-encoding">
                <option value="auto" selected>自動（BOM/UTF-8/SJIS/EUC）</option>
                <option value="utf-8">UTF-8</option>
                <option value="shift_jis">Shift_JIS</option>
                <option value="euc-jp">EUC-JP</option>
              </select>
            </label>
          </div>
        </div>
        <div
          id="right-file-cards"
          class="file-cards-bar file-cards-bar--horizontal"
          aria-label="files"
        ></div>
        <div id="right-message" class="pane-message" aria-live="polite"></div>
        <div id="right-editor" class="editor"></div>
      </section>
    </div>
  </div>
`;
