import { FILE_NAMES, type Commit, type FileName, type Files } from './types'

type Commits = Record<string, Commit>

/** id 自身を含む、たどれるすべての祖先 */
export function ancestors(commits: Commits, id: string): Set<string> {
  const seen = new Set<string>()
  const stack = [id]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (seen.has(current)) continue
    seen.add(current)
    stack.push(...commits[current].parents)
  }
  return seen
}

/** ancestor が descendant からたどれるか（同じコミットなら true） */
export function isAncestor(commits: Commits, ancestor: string, descendant: string): boolean {
  return ancestors(commits, descendant).has(ancestor)
}

/** 2つのコミットの共通祖先のうち、最も新しいもの */
export function mergeBase(commits: Commits, a: string, b: string): string {
  const fromA = ancestors(commits, a)
  const common = [...ancestors(commits, b)].filter((id) => fromA.has(id))
  const best = common.find((candidate) =>
    common.every((other) => other === candidate || !isAncestor(commits, candidate, other)),
  )
  // ルートコミット A を全員が共有しているため、共通祖先は必ず存在する
  return best!
}

export function changedFiles(before: Files, after: Files): FileName[] {
  return FILE_NAMES.filter((name) => before[name] !== after[name])
}

/** 両側で別々に変更されたファイル（Conflict になるもの） */
export function conflictingFiles(commits: Commits, ours: string, theirs: string): FileName[] {
  const base = commits[mergeBase(commits, ours, theirs)].files
  const oursFiles = commits[ours].files
  const theirsFiles = commits[theirs].files
  const changedByUs = new Set(changedFiles(base, oursFiles))
  return changedFiles(base, theirsFiles).filter(
    (name) => changedByUs.has(name) && oursFiles[name] !== theirsFiles[name],
  )
}

/** Conflict がない前提で、両側の変更を合わせた全体の状態を作る */
export function mergeFiles(commits: Commits, ours: string, theirs: string): Files {
  const base = commits[mergeBase(commits, ours, theirs)].files
  const oursFiles = commits[ours].files
  const theirsFiles = commits[theirs].files
  const merged = { ...oursFiles }
  for (const name of FILE_NAMES) {
    if (oursFiles[name] === base[name]) merged[name] = theirsFiles[name]
  }
  return merged
}
