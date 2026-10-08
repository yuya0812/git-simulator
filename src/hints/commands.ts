import type { SimEvent, State } from '../engine'

/** 操作に対応する、本物の Git での打ち方 */
export type GitCommand = {
  /** ターミナルで打つコマンド。GitHub の画面で行う操作には無い */
  command?: string
  /** 補足（GitHub の画面で行う操作など） */
  note?: string
}

/** clone の例に使うリポジトリの URL */
export const REPOSITORY_URL = 'https://github.com/team/profile.git'

function quote(message: string): string {
  return `"${message.replace(/(["\\$`])/g, '\\$1')}"`
}

/** ボタンやダイアログと、コマンド入力（Phase 7）で同じ書き方を使う */
export const git = {
  clone: () => `git clone ${REPOSITORY_URL}`,
  branch: (name: string) => `git branch ${name}`,
  switch: (name: string) => `git switch ${name}`,
  add: (file: string) => `git add ${file}`,
  restore: (file: string) => `git restore --staged --worktree ${file}`,
  commit: (message: string) => `git commit -m ${quote(message)}`,
  merge: (branch: string) => `git merge ${branch}`,
  push: (branch: string, firstTime: boolean) => (firstTime ? `git push -u origin ${branch}` : 'git push'),
  pull: () => 'git pull',
  deleteRemoteBranch: (name: string) => `git push origin --delete ${name}`,
}

export const ON_GITHUB = 'GitHub の画面で行う操作です（git コマンドは使いません）'

/** 成功した操作が、本物の Git ではどのコマンドだったか。state は操作後の状態 */
export function commandForEvent(event: SimEvent, state: State): GitCommand {
  switch (event.type) {
    case 'cloned':
      return { command: git.clone() }
    case 'branchCreated':
      return { command: event.switched ? `git switch -c ${event.name}` : git.branch(event.name) }
    case 'switched':
      return { command: git.switch(event.to) }
    case 'edited':
      return { note: 'エディタでファイルを編集しているだけなので、コマンドはありません' }
    case 'restored':
      return { command: git.restore(event.file) }
    case 'staged':
      return { command: git.add(event.file) }
    case 'committed':
      return { command: git.commit(state.commits[event.id].message) }
    case 'merged':
      return { command: git.merge(event.from) }
    case 'pushed':
      return {
        command: git.push(event.branch, event.created),
        note: event.created ? '-u は「このブランチは GitHub の同じ名前のブランチとつながっている」と覚えさせる指定です。2回目からは git push だけで送れます' : undefined,
      }
    case 'pulled':
      return { command: git.pull() }
    case 'prCreated':
      return { note: `${ON_GITHUB}。「Compare & pull request」ボタンから作ります` }
    case 'prApproved':
      return { note: 'チームメイトが GitHub の画面でレビューして「Approve」しました' }
    case 'prMerged':
      return { note: `${ON_GITHUB}。PR の「Merge pull request」ボタンを押します` }
    case 'remoteBranchDeleted':
      return {
        note: `${ON_GITHUB}。PR の「Delete branch」ボタンを押します。コマンドでは次のように書きます`,
        command: git.deleteRemoteBranch(event.name),
      }
    case 'teammateCommitted':
      return { note: 'チームメイトが自分のPCで commit と push をした結果です' }
  }
}
