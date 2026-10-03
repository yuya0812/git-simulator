import { conflictingFiles, isAncestor, mergeFiles } from '../graph'
import { addCommit, clone, requireFree, userChangedFiles } from '../repo'
import { ok, reject, type OpResult } from '../result'
import { FILE_NAMES, MAIN, type FileName, type State } from '../types'

/** GitHub 上で、push 済みのブランチから main への取り込みを依頼する */
export function createPullRequest(state: State, from: string): OpResult {
  const blocked = requireFree(state)
  if (blocked) return reject(blocked)
  if (from === MAIN) return reject({ code: 'prFromMain' })
  const remoteTip = state.remote.branches[from]
  if (!remoteTip) return reject({ code: 'prNotPushed', branch: from })
  const existing = state.pullRequests.find((pr) => pr.from === from && pr.status !== 'merged')
  if (existing) return reject({ code: 'prAlreadyOpen', branch: from, prId: existing.id })
  if (isAncestor(state.commits, remoteTip, state.remote.branches[MAIN])) {
    return reject({ code: 'prNothingToMerge', branch: from })
  }

  const next = clone(state)
  const prId = next.nextPullRequestId
  next.pullRequests.push({ id: prId, from, to: MAIN, status: 'open' })
  next.nextPullRequestId += 1
  return ok(next, { type: 'prCreated', prId, from, to: MAIN })
}

/** チームメイトがレビューして承認する（画面側で数秒後に自動で呼ぶ） */
export function approvePullRequest(state: State, prId: number): OpResult {
  const pr = state.pullRequests.find((p) => p.id === prId)
  if (!pr) return reject({ code: 'prNotFound', prId })
  if (pr.status === 'merged') return reject({ code: 'prAlreadyMerged', prId })
  if (pr.status === 'approved') return ok(state, { type: 'prApproved', prId })

  const next = clone(state)
  next.pullRequests.find((p) => p.id === prId)!.status = 'approved'
  return ok(next, { type: 'prApproved', prId })
}

/** 承認された PR を merge する。常にマージコミットを作る */
export function mergePullRequest(state: State, prId: number): OpResult {
  const pr = state.pullRequests.find((p) => p.id === prId)
  if (!pr) return reject({ code: 'prNotFound', prId })
  if (pr.status === 'merged') return reject({ code: 'prAlreadyMerged', prId })
  if (pr.status !== 'approved') return reject({ code: 'prNotApproved', prId })

  const ours = state.remote.branches[pr.to]
  const theirs = state.remote.branches[pr.from]
  const conflicts = conflictingFiles(state.commits, ours, theirs)
  if (conflicts.length > 0) {
    return reject({ code: 'conflict', files: conflicts, ours: `GitHub の ${pr.to}`, theirs: `GitHub の ${pr.from}` })
  }

  const next = clone(state)
  const id = addCommit(next, {
    message: `Merge pull request #${pr.id} from ${pr.from}`,
    parents: [ours, theirs],
    author: 'you',
    files: mergeFiles(next.commits, ours, theirs),
  })
  next.remote.branches[pr.to] = id
  const merged = next.pullRequests.find((p) => p.id === prId)!
  merged.status = 'merged'
  merged.mergeCommit = id
  return ok(next, { type: 'prMerged', prId, from: pr.from, to: pr.to, id })
}

/** merge 済みの PR のブランチを、GitHub から削除する。コミットは消えず、名札が外れるだけ */
export function deleteRemoteBranch(state: State, name: string): OpResult {
  const remoteTip = state.remote.branches[name]
  const mergedPr = state.pullRequests.some((pr) => pr.from === name && pr.status === 'merged')
  if (
    name === MAIN ||
    !remoteTip ||
    !mergedPr ||
    !isAncestor(state.commits, remoteTip, state.remote.branches[MAIN])
  ) {
    return reject({ code: 'cannotDeleteBranch', name })
  }

  const next = clone(state)
  delete next.remote.branches[name]
  return ok(next, { type: 'remoteBranchDeleted', name })
}

/** チームメイトが加える変更。回数を入れて、毎回プレビューで違いが分かるようにする */
const TEAMMATE_CHANGES: Record<FileName, (content: string, n: number) => string> = {
  'index.html': (content, n) => {
    const line = `  <p>チームメイトが index.html に追加した文です（${n}回目）</p>\n`
    return content.includes('</body>') ? content.replace('</body>', `${line}</body>`) : content + line
  },
  'style.css': (content, n) => {
    const colors = ['#e8f4ff', '#eafbea', '#fdeef4', '#f3edff']
    return `${content}\n/* チームメイトが背景色を変更（${n}回目） */\nbody {\n  background: ${colors[(n - 1) % colors.length]};\n}\n`
  },
  'script.js': (content, n) =>
    `${content}\n// チームメイトが追加（${n}回目）\nconst teammateNote${n} = document.createElement("p");\nteammateNote${n}.textContent = "チームメイトが script.js で追加した文です（${n}回目）";\ndocument.body.appendChild(teammateNote${n});\n`,
}

/** チームメイトが GitHub の main を更新する。ユーザーが変更していないファイルだけを変更する */
export function teammateUpdate(state: State): OpResult {
  const blocked = requireFree(state)
  if (blocked) return reject(blocked)
  const touched = new Set(userChangedFiles(state))
  // 毎回同じファイルにならないよう、回数に応じて選び始める位置をずらす
  const start = state.teammateUpdates % FILE_NAMES.length
  const rotated = [...FILE_NAMES.slice(start), ...FILE_NAMES.slice(0, start)]
  const file = rotated.find((name) => !touched.has(name))
  if (!file) return reject({ code: 'teammateNoFile' })

  const next = clone(state)
  next.teammateUpdates += 1
  const parent = next.remote.branches[MAIN]
  const files = { ...next.commits[parent].files }
  files[file] = TEAMMATE_CHANGES[file](files[file], next.teammateUpdates)
  const id = addCommit(next, {
    message: `${file} を更新`,
    parents: [parent],
    author: 'teammate',
    files,
  })
  next.remote.branches[MAIN] = id
  return ok(next, { type: 'teammateCommitted', id, file })
}
