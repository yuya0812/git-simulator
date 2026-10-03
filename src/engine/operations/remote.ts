import { ancestors, conflictingFiles, isAncestor, mergeFiles } from '../graph'
import { addCommit, checkout, clone, requireFree, uncommittedFiles } from '../repo'
import { confirmFirst, ok, reject, type ConfirmOption, type OpResult } from '../result'
import { MAIN, type Commit, type State } from '../types'

/** tips のどれからもたどれない、target 側だけにあるコミット（古い順） */
function commitsOnlyIn(commits: Record<string, Commit>, target: string, tips: string[]): string[] {
  const known = new Set(tips.flatMap((tip) => [...ancestors(commits, tip)]))
  return [...ancestors(commits, target)].filter((id) => !known.has(id)).sort(byCreationOrder(commits))
}

function byCreationOrder(commits: Record<string, Commit>) {
  const order = Object.keys(commits)
  return (a: string, b: string) => order.indexOf(a) - order.indexOf(b)
}

/** 今いるブランチを、リモートへ送る */
export function push(state: State, options: ConfirmOption = {}): OpResult {
  const blocked = requireFree(state)
  if (blocked) return reject(blocked)
  const local = state.local!
  const branch = local.current
  const localTip = local.branches[branch]
  const remoteTip = state.remote.branches[branch]

  if (remoteTip === localTip) return reject({ code: 'pushUpToDate', branch })
  // リモートの方に、手元にないコミットがある
  if (remoteTip && !isAncestor(state.commits, remoteTip, localTip)) return reject({ code: 'pushBehind', branch })
  if (branch === MAIN && !options.confirmed) return confirmFirst({ code: 'pushToMain' })

  const next = clone(state)
  const sentCommitIds = commitsOnlyIn(next.commits, localTip, Object.values(next.remote.branches))
  next.remote.branches[branch] = localTip
  return ok(next, { type: 'pushed', branch, created: !remoteTip, sentCommitIds })
}

/**
 * リモートの同じ名前のブランチの変更を、今いるブランチに取り込む。
 * 手元が進んでいなければ名札が移動するだけ（fast-forward）、両方進んでいればマージコミットを作る。
 */
export function pull(state: State): OpResult {
  const blocked = requireFree(state)
  if (blocked) return reject(blocked)
  const local = state.local!
  const branch = local.current
  const remoteTip = state.remote.branches[branch]
  if (!remoteTip) return reject({ code: 'noRemoteBranch', branch })
  const dirty = uncommittedFiles(state, local)
  if (dirty.length > 0) return reject({ code: 'uncommittedChanges', files: dirty })

  const localTip = local.branches[branch]
  if (isAncestor(state.commits, remoteTip, localTip)) {
    return ok(state, { type: 'pulled', branch, mode: 'upToDate', receivedCommitIds: [] })
  }

  const conflicts = conflictingFiles(state.commits, localTip, remoteTip)
  if (conflicts.length > 0) {
    return reject({ code: 'conflict', files: conflicts, ours: branch, theirs: `GitHub の ${branch}` })
  }

  const next = clone(state)
  const nextLocal = next.local!
  const receivedCommitIds = commitsOnlyIn(next.commits, remoteTip, Object.values(nextLocal.branches))

  if (isAncestor(next.commits, localTip, remoteTip)) {
    nextLocal.branches[branch] = remoteTip
    checkout(next, nextLocal, branch)
    return ok(next, { type: 'pulled', branch, mode: 'fastForward', receivedCommitIds })
  }

  const id = addCommit(next, {
    message: `Merge GitHub の ${branch} into ${branch}`,
    parents: [localTip, remoteTip],
    author: 'you',
    files: mergeFiles(next.commits, localTip, remoteTip),
  })
  nextLocal.branches[branch] = id
  checkout(next, nextLocal, branch)
  return ok(next, { type: 'pulled', branch, mode: 'merge', receivedCommitIds, id })
}
