# Git Simulator

Git の操作をブラウザ上でシミュレーションしながら、「今 Git の中で何が起きているのか」を確かめられる学習用の Web アプリ。

デモ: https://yuya0812.github.io/git-simulator/ （PC のブラウザで開いてください）

## できること

- clone からブランチ作成・編集・ステージング・コミット・push・PR・merge・pull までを、ボタン操作で一通り試せる
- 自分の PC（LOCAL）と GitHub（REMOTE）の状態を並べて表示する
- 操作のたびに「何をした / 何が変わった / 何は変わっていない」を表示する
- 各操作に対応する `git` コマンドを表示する
- 「チームメイトが main を更新」ボタンで、GitHub だけが先に進んだ状態を作れる（push が拒否される → pull する、の流れを試せる）
- コミットしていない変更があるときのブランチ移動など、実行できない操作は理由を説明する

題材のプロジェクトは `index.html` / `style.css` / `script.js` の3ファイルだけの自己紹介ページで、Conflict は扱わず、起きそうな操作は実行せずに説明する。

## 動かし方

Node.js 20.19 以上が必要です（`.nvmrc` で 20.20.0 を指定しています）。

```bash
nvm use
npm ci
npm run dev      # 開発サーバー
npm test         # テスト
npm run build    # 本番ビルド（dist/）
```

PC のブラウザ向けです。

## 技術スタック

- React 19 / TypeScript / Vite 8
- Tailwind CSS 4
- Zustand
- Vitest / oxlint
- GitHub Pages（GitHub Actions でデプロイ）

バックエンドや実際の Git は使っておらず、Git の振る舞いを TypeScript で再現しています。

## 構成

```text
src/
├── engine/      Git の振る舞いを再現する部分（React に依存しない純粋な TypeScript）
├── hints/       操作結果から、ヒント欄の文章と git コマンドを作る
├── store/       Zustand ストア
└── components/  画面部品
```

- 各操作は `(state) => OpResult` の純粋関数で、結果は「成功 / 実行しない（理由付き）/ 確認が必要」のいずれかを返します
- コミットは差分ではなく、3ファイルすべての中身（スナップショット）を持っています。ステージングも同じ形で持つので、「1つだけステージングしてコミットすると、もう1つは変更前の状態で記録される」といった挙動を再現できます
- エンジンとヒント文言には Vitest の単体テストがあります

## ドキュメント

| ファイル | 内容 |
|---|---|
| [要件定義書.md](要件定義書.md) | 要件定義書 v1.1 |
| [要件定義書_v1.0.md](要件定義書_v1.0.md) | 最初の要件定義書 |
| [ヒアリングメモ.md](ヒアリングメモ.md) | 要件を決めたときのメモ |
| [docs/spec/git-simulator-plan.md](docs/spec/git-simulator-plan.md) | 実装計画 |

## 開発について

AI を使って開発しています。最初の要件定義書は ChatGPT で下書きし、それをもとに Claude Code と要件を詰めてから、実装も Claude Code と一緒に進めました。

## 開発状況

- [x] Git シミュレーションエンジン
- [x] ヒント欄の文章
- [x] 画面の骨組みと操作
- [x] git コマンドの表示
- [x] LOCAL / REMOTE のグラフ
- [x] アプリのプレビューと Diff 表示
- [x] コマンド入力
- [x] 仕上げと公開
