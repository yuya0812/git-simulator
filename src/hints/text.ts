/** 文章で使う共通の言い回し */

export const PC = '自分のPC'
export const GITHUB = 'GitHub'

export function files(names: readonly string[]): string {
  return names.join(' と ')
}

export function commitLabel(id: string): string {
  return `コミット ${id}`
}

export function commitList(ids: readonly string[]): string {
  return ids.map(commitLabel).join('、')
}
