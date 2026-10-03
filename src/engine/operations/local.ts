import { changedFiles, conflictingFiles, isAncestor, mergeFiles } from '../graph'
import { addCommit, checkout, clone, headFiles, headId, joinFileNames, requireFree, uncommittedFiles } from '../repo'
import { confirmFirst, ok, reject, type ConfirmOption, type OpResult } from '../result'
import { MAIN, type FileName, type State } from '../types'

/** GitHub のプロジェクトを、履歴ごと自分の PC にコピーする */
export function cloneRepo(state: State): OpResult {
  if (state.phase !== 'beforeClone') return reject({ code: 'alreadyCloned' })
  const next = clone(state)
  const files = next.commits[next.remote.branches[MAIN]].files
  next.local = {
    branches: { ...next.remote.branches },
    current: MAIN,
    index: { ...files },
    workingTree: { ...files },
  }
  next.phase = 'beforeBranch'
  return ok(next, { type: 'cloned', commitIds: Object.keys(next.commits) })
}

export const BRANCH_NAME_EXAMPLE = 'feature/profile'

export function isValidBranchName(name: string): boolean {
  return (
    /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(name) &&
    !name.includes('..') &&
    !name.includes('//') &&
    !name.endsWith('/') &&
    !name.endsWith('.')
  )
}

/** 今いるブランチの現在地点に、新しい名札を付ける */
export function createBranch(state: State, name: string, options: { switchTo?: boolean } = {}): OpResult {
  if (state.phase === 'beforeClone' || !state.local) return reject({ code: 'notCloned' })
  if (!isValidBranchName(name)) return reject({ code: 'invalidBranchName', name })
  if (state.local.branches[name]) return reject({ code: 'branchExists', name })

  const switchTo = options.switchTo ?? false
  const next = clone(state)
  const local = next.local!
  const at = headId(local)
  local.branches[name] = at
  // 新しいブランチは今と同じコミットを指すので、編集中の変更を持ったまま移動しても食い違わない
  if (switchTo) local.current = name
  next.phase = 'free'
  return ok(next, { type: 'branchCreated', name, at, switched: switchTo })
}

/** ブランチを切り替える。コミットしていない変更があるときは止める */
export function switchBranch(state: State, name: string): OpResult {
  const blocked = requireFree(state)
  if (blocked) return reject(blocked)
  const local = state.local!
  if (!local.branches[name]) return reject({ code: 'branchNotFound', name })
  if (local.current === name) return reject({ code: 'alreadyOnBranch', name })
  const files = uncommittedFiles(state, local)
  if (files.length > 0) return reject({ code: 'uncommittedChanges', files })

  const next = clone(state)
  const from = next.local!.current
  const fromCommit = headId(next.local!)
  const at = next.local!.branches[name]
  checkout(next, next.local!, name)
  const changed = changedFiles(next.commits[fromCommit].files, next.commits[at].files)
  return ok(next, { type: 'switched', from, to: name, fromCommit, at, changedFiles: changed })
}

export function editFile(state: State, file: FileName, content: string): OpResult {
  const blocked = requireFree(state)
  if (blocked) return reject(blocked)
  const next = clone(state)
  next.local!.workingTree[file] = content
  return ok(next, { type: 'edited', file })
}

/** そのファイルを、最後にコミットした内容に戻す（編集中・ステージングの両方） */
export function restoreFile(state: State, file: FileName): OpResult {
  const blocked = requireFree(state)
  if (blocked) return reject(blocked)
  const local = state.local!
  if (!uncommittedFiles(state, local).includes(file)) return reject({ code: 'noChangeToRestore', file })

  const next = clone(state)
  const committed = headFiles(next, next.local!)[file]
  next.local!.workingTree[file] = committed
  next.local!.index[file] = committed
  return ok(next, { type: 'restored', file })
}

/** 編集中の内容を、ステージングに置く */
export function stageFile(state: State, file: FileName): OpResult {
  const blocked = requireFree(state)
  if (blocked) return reject(blocked)
  const local = state.local!
  if (local.workingTree[file] === local.index[file]) return reject({ code: 'noChangeToStage', file })

  const next = clone(state)
  next.local!.index[file] = next.local!.workingTree[file]
  return ok(next, { type: 'staged', file })
}

/** ステージングに置いたファイルの名前から、コミットメッセージの初期値を作る */
export function defaultCommitMessage(state: State): string {
  const local = state.local
  if (!local) return ''
  const files = changedFiles(headFiles(state, local), local.index)
  return files.length > 0 ? `${joinFileNames(files)} を変更` : ''
}

/** ステージングにある「全体の状態」を、新しいコミットとして記録する */
export function commit(state: State, options: ConfirmOption & { message?: string } = {}): OpResult {
  const blocked = requireFree(state)
  if (blocked) return reject(blocked)
  const local = state.local!
  const changed = changedFiles(headFiles(state, local), local.index)
  if (changed.length === 0) return reject({ code: 'nothingStaged' })
  if (local.current === MAIN && !options.confirmed) return confirmFirst({ code: 'commitOnMain' })

  const next = clone(state)
  const nextLocal = next.local!
  const message = options.message?.trim() || defaultCommitMessage(state)
  const id = addCommit(next, {
    message,
    parents: [headId(nextLocal)],
    author: 'you',
    files: { ...nextLocal.index },
  })
  nextLocal.branches[nextLocal.current] = id
  const leftUnstaged = changedFiles(nextLocal.index, nextLocal.workingTree)
  return ok(next, { type: 'committed', id, branch: nextLocal.current, changedFiles: changed, leftUnstaged })
}

/** 別のブランチを、今いるブランチに取り込む。PR と同じく常にマージコミットを作る */
export function mergeLocal(state: State, from: string, options: ConfirmOption = {}): OpResult {
  const blocked = requireFree(state)
  if (blocked) return reject(blocked)
  const local = state.local!
  const into = local.current
  if (!local.branches[from]) return reject({ code: 'branchNotFound', name: from })
  if (from === into) return reject({ code: 'mergeSelf', name: from })
  const dirty = uncommittedFiles(state, local)
  if (dirty.length > 0) return reject({ code: 'uncommittedChanges', files: dirty })

  const ours = local.branches[into]
  const theirs = local.branches[from]
  if (isAncestor(state.commits, theirs, ours)) return reject({ code: 'alreadyMerged', into, from })
  const conflicts = conflictingFiles(state.commits, ours, theirs)
  if (conflicts.length > 0) return reject({ code: 'conflict', files: conflicts, ours: into, theirs: from })
  if (!options.confirmed) return confirmFirst({ code: 'localMerge', into, from })

  const next = clone(state)
  const id = addCommit(next, {
    message: `Merge branch '${from}' into ${into}`,
    parents: [ours, theirs],
    author: 'you',
    files: mergeFiles(next.commits, ours, theirs),
  })
  next.local!.branches[into] = id
  checkout(next, next.local!, into)
  return ok(next, { type: 'merged', into, from, id })
}
