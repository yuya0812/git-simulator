import { MAIN, type Commit, type Files, type State } from './types'

/** 仮想プロジェクト（自己紹介ページ）の初期内容 */
export const INITIAL_FILES: Files = {
  'index.html': `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>自己紹介</title>
</head>
<body>
  <h1>ギット たろう</h1>
  <ul>
    <li>趣味: 散歩とカフェめぐり</li>
    <li>所属: 開発チーム</li>
  </ul>
  <p class="message">一言: Git を勉強中です！</p>
  <button id="like">いいね</button>
  <span id="count">0</span>
</body>
</html>
`,
  'style.css': `body {
  font-family: sans-serif;
  background: #fffbea;
  color: #333333;
  padding: 24px;
}

h1 {
  color: #e07a2e;
}

.message {
  font-weight: bold;
}

button {
  padding: 6px 16px;
  border: none;
  border-radius: 999px;
  background: #f6b26b;
  cursor: pointer;
}
`,
  'script.js': `let count = 0;
const button = document.getElementById("like");
const label = document.getElementById("count");

button.addEventListener("click", () => {
  count += 1;
  label.textContent = count;
});
`,
}

/** 0 → A, 25 → Z, 26 → AA ... */
export function commitIdFromIndex(index: number): string {
  let n = index
  let id = ''
  do {
    id = String.fromCharCode(65 + (n % 26)) + id
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return id
}

/** アプリを開いたときの状態。リモートにだけプロジェクトがある */
export function createInitialState(): State {
  const first: Commit = {
    id: commitIdFromIndex(0),
    message: '最初のコミット',
    parents: [],
    author: 'teammate',
    files: { ...INITIAL_FILES },
  }
  return {
    commits: { [first.id]: first },
    nextCommitIndex: 1,
    remote: { branches: { [MAIN]: first.id } },
    local: null,
    pullRequests: [],
    nextPullRequestId: 1,
    teammateUpdates: 0,
    phase: 'beforeClone',
  }
}
