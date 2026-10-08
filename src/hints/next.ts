import { BRANCH_NAME_EXAMPLE, changedFiles, headFiles, isAncestor, MAIN, type State } from '../engine'
import { files, GITHUB } from './text'

/** 今の状態から「次にできること」を、優先度の高い順に返す */
export function suggestNext(state: State): string[] {
  if (state.phase === 'beforeClone') {
    return [`まずは ${GITHUB} にあるプロジェクトを clone して、自分のPCにコピーしよう`]
  }
  const local = state.local!
  if (state.phase === 'beforeBranch') {
    return [`main から作業用のブランチを作ろう（名前の例: ${BRANCH_NAME_EXAMPLE}）`]
  }

  const suggestions: string[] = []
  const current = local.current
  const head = headFiles(state, local)
  const staged = changedFiles(head, local.index)
  const unstaged = changedFiles(local.index, local.workingTree)
  const localTip = local.branches[current]
  const remoteTip = state.remote.branches[current]
  const remoteMain = state.remote.branches[MAIN]
  const featureBranches = Object.keys(local.branches).filter((name) => name !== MAIN)

  // 作業用のブランチがあるのに、GitHub と同じ状態の main にいる
  // （main がずれているときは、下の push / pull の提案に任せる）
  if (
    current === MAIN &&
    featureBranches.length > 0 &&
    staged.length === 0 &&
    unstaged.length === 0 &&
    localTip === remoteMain
  ) {
    suggestions.push(`作業用のブランチ（${featureBranches[0]}）に移動して、作業を始めよう`)
  }

  if (unstaged.length > 0) suggestions.push(`変更した ${files(unstaged)} をステージングに置こう`)
  if (staged.length > 0) suggestions.push('ステージングに置いたので、コミットできます')

  if (staged.length === 0 && unstaged.length === 0) {
    // まだ送っていないコミットがある
    if (!remoteTip || (remoteTip !== localTip && isAncestor(state.commits, remoteTip, localTip))) {
      if (localTip !== remoteMain && !isAncestor(state.commits, localTip, remoteMain)) {
        suggestions.push(`${current} を push して、${GITHUB} に送ろう`)
      }
    } else if (remoteTip !== localTip && !isAncestor(state.commits, remoteTip, localTip)) {
      suggestions.push(`${GITHUB} の ${current} が先に進んでいます。pull して取り込もう`)
    }
  }

  for (const pr of state.pullRequests) {
    if (pr.status === 'open') suggestions.push(`PR #${pr.id} はチームメイトがレビュー中です。承認を待とう`)
    if (pr.status === 'approved') suggestions.push(`PR #${pr.id} が承認されました。merge しよう`)
    if (pr.status === 'merged' && state.remote.branches[pr.from]) {
      suggestions.push(`merge 済みの ${pr.from} は、${GITHUB} から削除できます`)
    }
  }

  // push 済みで、まだ PR がないブランチ
  for (const name of featureBranches) {
    const tip = state.remote.branches[name]
    const hasPr = state.pullRequests.some((pr) => pr.from === name && pr.status !== 'merged')
    if (tip && !hasPr && !isAncestor(state.commits, tip, remoteMain)) {
      suggestions.push(`${name} の PR を作って、main に取り込んでもらう依頼をしよう`)
    }
  }

  // GitHub で merge されたが、自分の PC の main がまだ古い
  const localMain = local.branches[MAIN]
  if (current !== MAIN && localMain !== remoteMain && isAncestor(state.commits, localMain, remoteMain)) {
    suggestions.push(`${GITHUB} の main が進んでいます。main に移動して pull しよう`)
  }

  if (suggestions.length === 0) {
    suggestions.push('ファイルを編集してみよう。プレビューで変化を確かめられます')
    suggestions.push(`「チームメイトが main を更新」ボタンで、${GITHUB} だけが先に進む状態を試してみよう`)
  }
  return [...new Set(suggestions)].slice(0, 3)
}
