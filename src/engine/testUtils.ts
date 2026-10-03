import { createInitialState } from './initial'
import { cloneRepo, commit, createBranch, editFile, stageFile } from './operations/local'
import type { OpResult } from './result'
import type { FileName, State } from './types'

/** 成功を前提に次の状態を取り出す */
export function expectOk(result: OpResult): State {
  if (result.kind !== 'ok') throw new Error(`ok を期待したが ${JSON.stringify(result)}`)
  return result.state
}

export function rejectionCode(result: OpResult): string | undefined {
  return result.kind === 'rejected' ? result.rejection.code : undefined
}

/** clone して feature/profile を作り、そこへ移動した状態 */
export function onFeatureBranch(): State {
  const cloned = expectOk(cloneRepo(createInitialState()))
  return expectOk(createBranch(cloned, 'feature/profile', { switchTo: true }))
}

export function editStageCommit(state: State, file: FileName, content: string, message?: string): State {
  const edited = expectOk(editFile(state, file, content))
  const staged = expectOk(stageFile(edited, file))
  return expectOk(commit(staged, { message, confirmed: true }))
}
