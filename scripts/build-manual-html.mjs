import fs from "node:fs/promises";
import path from "node:path";

const OUT_FILE = path.resolve("doc/MANUAL.html");
const ASSET_DIR = path.resolve("doc/manual-assets");

async function loadImage(name) {
  const filePath = path.join(ASSET_DIR, name);
  const buffer = await fs.readFile(filePath);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

const images = {
  overview: await loadImage("overview.png"),
  diff: await loadImage("diff.png"),
  anchors: await loadImage("anchors.png"),
  toggles: await loadImage("toggles.png"),
  darkTheme: await loadImage("dark-theme.png"),
  workspace: await loadImage("workspace.png"),
  paths: await loadImage("paths.png"),
  gotoLine: await loadImage("goto-line.png"),
  fileCardJump: await loadImage("file-card-jump.png"),
};

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>diff-viewer 操作マニュアル</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #efe5d6;
      --panel: #fbf7ef;
      --text: #3a2f22;
      --muted: #6b5a46;
      --accent: #d1b07c;
      --border: rgba(140, 120, 95, 0.4);
      --shadow: 0 16px 34px rgba(50, 40, 30, 0.15);
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      font-family: "Segoe UI", "Yu Gothic", "Meiryo", sans-serif;
      background: radial-gradient(circle at top, #f6efe3 0%, #e7dac6 70%);
      color: var(--text);
      line-height: 1.7;
    }
    header {
      padding: 36px 20px 20px;
      text-align: center;
    }
    header h1 {
      margin: 0 0 10px;
      font-size: 2rem;
      letter-spacing: 0.04em;
    }
    header p {
      margin: 0;
      color: var(--muted);
      font-size: 1rem;
    }
    main {
      max-width: 980px;
      margin: 0 auto;
      padding: 12px 20px 80px;
    }
    nav.toc {
      background: var(--panel);
      border-radius: 18px;
      border: 1px solid var(--border);
      padding: 16px 20px;
      box-shadow: var(--shadow);
      margin-bottom: 32px;
    }
    nav.toc h2 {
      margin: 0 0 10px;
      font-size: 1rem;
      color: var(--muted);
      letter-spacing: 0.08em;
    }
    nav.toc ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 8px;
    }
    nav.toc a {
      text-decoration: none;
      color: var(--text);
      font-weight: 600;
    }
    section {
      margin-top: 48px;
      background: var(--panel);
      border-radius: 20px;
      border: 1px solid var(--border);
      padding: 24px;
      box-shadow: var(--shadow);
    }
    section h2 {
      margin: 0 0 12px;
      font-size: 1.4rem;
    }
    section h3 {
      margin: 18px 0 8px;
      font-size: 1.05rem;
      color: var(--muted);
    }
    figure {
      margin: 18px 0 0;
    }
    img {
      width: 100%;
      max-width: 920px;
      display: block;
      margin: 0 auto;
      border-radius: 16px;
      border: 1px solid rgba(120, 100, 75, 0.35);
      box-shadow: 0 12px 28px rgba(40, 30, 20, 0.2);
    }
    figcaption {
      margin-top: 8px;
      text-align: center;
      color: var(--muted);
      font-size: 0.9rem;
    }
    ul {
      padding-left: 20px;
      margin: 8px 0 0;
    }
    .hint {
      margin-top: 12px;
      padding: 10px 14px;
      border-radius: 12px;
      background: rgba(209, 176, 124, 0.2);
      color: var(--muted);
      font-size: 0.95rem;
    }
    .shortcut-grid {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }
    .shortcut-item {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.6);
      font-size: 0.95rem;
    }
    .shortcut-key {
      font-weight: 700;
      white-space: nowrap;
    }
    @media (max-width: 720px) {
      header {
        padding: 28px 16px 16px;
      }
      main {
        padding: 10px 14px 60px;
      }
      section {
        padding: 20px;
      }
      .shortcut-item {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>diff-viewer 操作マニュアル</h1>
    <p>初見ユーザーが迷わず使える、画像付きの簡潔ガイドです。</p>
  </header>
  <main>
    <nav class="toc">
      <h2>目次</h2>
      <ul>
        <li><a href="#overview">1. ツール概要</a></li>
        <li><a href="#load">2. ファイルを読み込む</a></li>
        <li><a href="#diff">3. 差分の見方</a></li>
        <li><a href="#controls">4. 主要操作（再計算/移動/トグル）</a></li>
        <li><a href="#anchors">5. アンカー機能</a></li>
        <li><a href="#workspace">6. ワークスペース</a></li>
        <li><a href="#paths">7. パス登録UI</a></li>
        <li><a href="#goto-line">8. 行ジャンプUI</a></li>
        <li><a href="#shortcuts">9. ショートカット一覧</a></li>
      </ul>
    </nav>

    <section id="overview">
      <h2>1. ツール概要</h2>
      <p>左右のペインでファイルを並べて差分を確認するための、単一HTMLツールです。</p>
      <ul>
        <li>左右ペインに独立した内容を読み込み、差分を可視化します。</li>
        <li>スクロール連動や差分のみ表示など、比較に必要な機能をまとめています。</li>
      </ul>
      <p class="hint">よくあるミス: 最初にどこから操作するか分からない場合は、左上の「ワークスペース名」や各ペインの「ファイルを選択」を確認してください。</p>
      <figure>
        <img src="${images.overview}" alt="初期画面" />
        <figcaption>初期画面の全体像</figcaption>
      </figure>
    </section>

    <section id="load">
      <h2>2. ファイルを読み込む</h2>
      <p>各ペインの「ファイルを選択」からファイルを読み込みます。</p>
      <ul>
        <li>複数ファイルを一度に選択すると、ペイン内に連結して表示されます。</li>
        <li>ペインにドラッグ&ドロップして読み込むこともできます。</li>
        <li>cshtml → cshtml.cs の順で選んでも、cshtml.cs → cshtml の順で読み込みます。</li>
        <li>ファイルカードをクリックすると、そのファイルの先頭にジャンプします。</li>
      </ul>
      <p class="hint">よくあるミス: 片方だけ読み込むと差分が空になるため、左右両方に読み込んでください。</p>
      <figure>
        <img src="${images.diff}" alt="差分が見える読み込み状態" />
        <figcaption>左右に内容を読み込んだ状態</figcaption>
      </figure>
      <figure>
        <img src="${images.fileCardJump}" alt="ファイルカードで先頭にジャンプ" />
        <figcaption>ファイルカード押下で先頭行にジャンプ</figcaption>
      </figure>
    </section>

    <section id="diff">
      <h2>3. 差分の見方</h2>
      <p>追加/削除/変更の行が色で強調されます。行内差分もハイライトされます。</p>
      <ul>
        <li>行の背景色で差分を把握できます。</li>
        <li>ハイライトをOFFにすると、色による強調を抑えられます。</li>
      </ul>
      <p class="hint">よくあるミス: 色が見えにくいときは「ハイライト」をONにしてください。</p>
      <figure>
        <img src="${images.diff}" alt="差分の表示例" />
        <figcaption>差分の表示例</figcaption>
      </figure>
    </section>

    <section id="controls">
      <h2>4. 主要操作（再計算/移動/トグル）</h2>
      <p>ヘッダーのボタンとトグルで差分比較の基本操作を行います。</p>
      <ul>
        <li>「差分再計算」: 内容を再比較します。</li>
        <li>「前の差分 / 次の差分」: 差分ブロックへ移動します。</li>
        <li>「スクロール連動」: 左右のスクロール同期を切り替えます。</li>
        <li>「ハイライト」: 差分の色強調を切り替えます。</li>
        <li>「差分のみ表示」: 差分のない行を折りたたみます。</li>
        <li>「テーマ切り替え」: ライト/ダークテーマを切り替えます。</li>
      </ul>
      <p class="hint">よくあるミス: 差分が更新されないときは「差分再計算」を押してください。</p>
      <figure>
        <img src="${images.toggles}" alt="主要トグルの位置" />
        <figcaption>主要トグルと操作ボタン</figcaption>
      </figure>
      <figure>
        <img src="${images.darkTheme}" alt="ダークテーマ表示" />
        <figcaption>ダークテーマの表示例</figcaption>
      </figure>
    </section>

    <section id="anchors">
      <h2>5. アンカー機能</h2>
      <p>アンカーは「左右の対応行を固定する」ための目印です。</p>
      <ul>
        <li>行番号をクリック、または Ctrl+L でアンカーを追加/解除します。</li>
        <li>アンカー一覧から該当行へジャンプできます。</li>
      </ul>
      <p class="hint">よくあるミス: 期待した行に飛ばない場合は、左右の行番号が一致しているか確認してください。</p>
      <figure>
        <img src="${images.anchors}" alt="アンカー一覧と差分" />
        <figcaption>アンカー一覧が表示された状態</figcaption>
      </figure>
    </section>

    <section id="workspace">
      <h2>6. ワークスペース</h2>
      <p>用途ごとにワークスペースを分けて作業できます。</p>
      <ul>
        <li>左上のワークスペース名をクリックすると一覧が開きます。</li>
        <li>「＋」で新規作成、ペンでリネーム、ゴミ箱で削除します（最後の1件は削除不可）。</li>
        <li>ドラッグ&ドロップで並び替えできます。</li>
      </ul>
      <p class="hint">よくあるミス: 似た名前が並ぶと混乱するため、用途ごとに明確な名前を付けてください。</p>
      <figure>
        <img src="${images.workspace}" alt="ワークスペース一覧" />
        <figcaption>ワークスペースUI</figcaption>
      </figure>
    </section>

    <section id="paths">
      <h2>7. パス登録UI</h2>
      <p>よく使うファイルパスを登録して、ワンクリックでコピーできます。</p>
      <ul>
        <li>「パス登録」ボタンまたは Ctrl+P で開閉します。</li>
        <li>ドラッグ&ドロップで並び替えできます。</li>
      </ul>
      <p class="hint">よくあるミス: Ctrl+P で開く対象は「最後に操作したペイン」です。</p>
      <figure>
        <img src="${images.paths}" alt="パス登録UI" />
        <figcaption>パス登録UI</figcaption>
      </figure>
    </section>

    <section id="goto-line">
      <h2>8. 行ジャンプUI</h2>
      <p>Ctrl+Gで行ジャンプUIを開き、行番号を指定してその行へ移動できます。</p>
      <ul>
        <li>ジャンプ対象は「フォーカス中のペイン」のファイル単位です。</li>
        <li>行番号を入力して確定すると、その行へ移動します。</li>
      </ul>
      <p class="hint">よくあるミス: 空欄のままでは移動しないので、行番号を入力してください。</p>
      <figure>
        <img src="${images.gotoLine}" alt="行ジャンプUI" />
        <figcaption>行ジャンプUI</figcaption>
      </figure>
    </section>

    <section id="shortcuts">
      <h2>9. ショートカット一覧（Windows）</h2>
      <div class="shortcut-grid">
        <div class="shortcut-item">
          <span class="shortcut-key">Ctrl+F</span>
          <span>検索UIを開く（フォーカス中のペイン）</span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-key">Ctrl+G</span>
          <span>行ジャンプUIを開く（ファイル単位）</span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-key">Ctrl+J / Ctrl+K</span>
          <span>左ペイン / 右ペインへフォーカス移動</span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-key">Ctrl+L</span>
          <span>アンカーの追加/解除</span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-key">Ctrl+P</span>
          <span>パス登録UIの開閉</span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-key">Ctrl+Z / Ctrl+Y</span>
          <span>編集のUndo / Redo</span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-key">Alt+Z</span>
          <span>折り返しの切り替え（対応行が横に並ばない場合あり）</span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-key">Alt+N</span>
          <span>ワークスペースUIの開閉</span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-key">↑/↓</span>
          <span>ワークスペース一覧/アンカー一覧/パス一覧の選択移動</span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-key">Enter</span>
          <span>ワークスペースの選択確定 / パスのコピー</span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-key">Delete</span>
          <span>パス一覧の削除</span>
        </div>
      </div>
    </section>
  </main>
</body>
</html>
`;

await fs.writeFile(OUT_FILE, html, "utf8");
