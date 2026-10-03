import { commitIdFromIndex } from './initial'
import { changedFiles, mergeBase } from './graph'
import type { Rejection } from './result'
import { FILE_NAMES, MAIN, type Commit, type FileName, type Files, type LocalRepo, type State } from './types'

/** 状態は小さいので、操作のたびに丸ごと複製して不変に扱う */
export function clone(state: State): State {
  return structuredClone(state)
}

export function addCommit(state: State, commit: Omit<Commit, 'id'>): string {
  const id = commitIdFromIndex(state.nextCommitIndex)
  state.commits[id] = { ...commit, id }
  state.nextCommitIndex += 1
  return id
}

export function headId(local: LocalRepo): string {
  return local.branches[local.current]
}

export function headFiles(state: State, local: LocalRepo): Files {
  return state.commits[headId(local)].files
}

/** まだコミットしていない変更があるファイル（編集中・ステージング中） */
export function uncommittedFiles(state: State, local: LocalRepo): FileName[] {
  const head = headFiles(state, local)
  const changed = new Set([...changedFiles(head, local.workingTree), ...changedFiles(head, local.index)])
  return FILE_NAMES.filter((name) => changed.has(name))
}

/** チェックアウトして、編集中・ステージングをそのコミットの状態にそろえる */
export function checkout(state: State, local: LocalRepo, branch: string): void {
  local.current = branch
  const files = state.commits[local.branches[branch]].files
  local.index = { ...files }
  local.workingTree = { ...files }
}

/**
 * ユーザーが変更したファイル。チームメイトはこれ以外のファイルを変更する（要件 8章）。
 * 編集中・ステージング中のファイルと、リモートの main にまだ取り込まれていないコミットで変更したファイル。
 */
export function userChangedFiles(state: State): FileName[] {
  const local = state.local
  if (!local) return []
  const changed = new Set(uncommittedFiles(state, local))
  const remoteMain = state.remote.branches[MAIN]
  for (const tip of Object.values(local.branches)) {
    const base = mergeBase(state.commits, tip, remoteMain)
    for (const name of changedFiles(state.commits[base].files, state.commits[tip].files)) changed.add(name)
  }
  return FILE_NAMES.filter((name) => changed.has(name))
}

/** 序盤の固定手順が終わっていない操作を止める */
export function requireFree(state: State): Rejection | null {
  if (state.phase === 'beforeClone') return { code: 'notCloned' }
  if (state.phase === 'beforeBranch') return { code: 'createBranchFirst' }
  return null
}

export function joinFileNames(files: FileName[]): string {
  return files.join(' と ')
}
