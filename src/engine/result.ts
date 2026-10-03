import type { FileName, State } from './types'

/** 操作が成功したときに起きたこと。ヒント欄の文章の材料になる */
export type SimEvent =
  | { type: 'cloned'; commitIds: string[] }
  | { type: 'branchCreated'; name: string; at: string; switched: boolean }
  /** changedFiles: 移動前後でファイルの中身が変わったもの（同じコミットなら空） */
  | { type: 'switched'; from: string; to: string; fromCommit: string; at: string; changedFiles: FileName[] }
  | { type: 'edited'; file: FileName }
  | { type: 'restored'; file: FileName }
  | { type: 'staged'; file: FileName }
  | { type: 'committed'; id: string; branch: string; changedFiles: FileName[]; leftUnstaged: FileName[] }
  | { type: 'merged'; into: string; from: string; id: string }
  | { type: 'pushed'; branch: string; created: boolean; sentCommitIds: string[] }
  | { type: 'pulled'; branch: string; mode: 'upToDate' | 'fastForward' | 'merge'; receivedCommitIds: string[]; id?: string }
  | { type: 'prCreated'; prId: number; from: string; to: string }
  | { type: 'prApproved'; prId: number }
  | { type: 'prMerged'; prId: number; from: string; to: string; id: string }
  | { type: 'remoteBranchDeleted'; name: string }
  | { type: 'teammateCommitted'; id: string; file: FileName }

/** 実行しなかった理由。エラーではなく、説明を出すための情報 */
export type Rejection =
  | { code: 'alreadyCloned' }
  | { code: 'notCloned' }
  | { code: 'createBranchFirst' }
  | { code: 'invalidBranchName'; name: string }
  | { code: 'branchExists'; name: string }
  | { code: 'branchNotFound'; name: string }
  | { code: 'alreadyOnBranch'; name: string }
  | { code: 'uncommittedChanges'; files: FileName[] }
  | { code: 'noChangeToStage'; file: FileName }
  | { code: 'noChangeToRestore'; file: FileName }
  | { code: 'nothingStaged' }
  | { code: 'mergeSelf'; name: string }
  | { code: 'alreadyMerged'; into: string; from: string }
  | { code: 'conflict'; files: FileName[]; ours: string; theirs: string }
  | { code: 'pushUpToDate'; branch: string }
  | { code: 'pushBehind'; branch: string }
  | { code: 'noRemoteBranch'; branch: string }
  | { code: 'prFromMain' }
  | { code: 'prNotPushed'; branch: string }
  | { code: 'prAlreadyOpen'; branch: string; prId: number }
  | { code: 'prNothingToMerge'; branch: string }
  | { code: 'prNotFound'; prId: number }
  | { code: 'prNotApproved'; prId: number }
  | { code: 'prAlreadyMerged'; prId: number }
  | { code: 'cannotDeleteBranch'; name: string }
  | { code: 'teammateNoFile' }

/** 実行はできるが、先に確認を取る操作 */
export type Warning =
  | { code: 'commitOnMain' }
  | { code: 'pushToMain' }
  | { code: 'localMerge'; into: string; from: string }

export type OpResult =
  | { kind: 'ok'; state: State; event: SimEvent }
  | { kind: 'rejected'; rejection: Rejection }
  /** 同じ操作を `confirmed: true` を付けてもう一度呼ぶと実行される */
  | { kind: 'needsConfirm'; warning: Warning }

export type ConfirmOption = { confirmed?: boolean }

export const ok = (state: State, event: SimEvent): OpResult => ({ kind: 'ok', state, event })
export const reject = (rejection: Rejection): OpResult => ({ kind: 'rejected', rejection })
export const confirmFirst = (warning: Warning): OpResult => ({ kind: 'needsConfirm', warning })
