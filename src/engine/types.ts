export const FILE_NAMES = ['index.html', 'style.css', 'script.js'] as const

export type FileName = (typeof FILE_NAMES)[number]

/** プロジェクト全体の状態（3ファイルすべての中身） */
export type Files = Record<FileName, string>

export type Author = 'you' | 'teammate'

export type Commit = {
  /** 作られた順に A, B, C... */
  id: string
  message: string
  /** マージコミットは2つ */
  parents: string[]
  author: Author
  /** その時点のプロジェクト全体のスナップショット */
  files: Files
}

export type LocalRepo = {
  /** ブランチ名 → コミットID */
  branches: Record<string, string>
  /** 今いるブランチ */
  current: string
  /** ステージング。次のコミットになる「全体の状態」を持つ（本物の Git の index と同じ） */
  index: Files
  /** 編集中のファイル */
  workingTree: Files
}

export type PullRequestStatus = 'open' | 'approved' | 'merged'

export type PullRequest = {
  id: number
  from: string
  to: string
  status: PullRequestStatus
  mergeCommit?: string
}

/** 序盤の固定手順（clone → ブランチ作成）の進み具合 */
export type Phase = 'beforeClone' | 'beforeBranch' | 'free'

export type State = {
  /** 全コミット。LOCAL / REMOTE で共通の置き場 */
  commits: Record<string, Commit>
  nextCommitIndex: number
  remote: { branches: Record<string, string> }
  /** clone 前は null */
  local: LocalRepo | null
  pullRequests: PullRequest[]
  nextPullRequestId: number
  /** チームメイトが更新した回数（変更内容に番号を付けるため） */
  teammateUpdates: number
  phase: Phase
}

export const MAIN = 'main'
