import { ancestors, MAIN, type State } from '../../engine'

export type GraphLayout = {
  /** 表示する列の並び（コミットが作られた順）。LOCAL と REMOTE で共通 */
  columns: string[]
  /** コミット ID → 段（0 が一番上） */
  lanes: Record<string, number>
  laneCount: number
}

/** 名札（ブランチ）からたどれるコミット */
export function visibleCommits(state: State, branches: Record<string, string>): Set<string> {
  return new Set(Object.values(branches).flatMap((tip) => [...ancestors(state.commits, tip)]))
}

/**
 * グラフの配置を作る。
 * 列（左右）は LOCAL と REMOTE で共通にするので、片方にだけ無いコミットが「空き」として見える。
 * 段（上下）は side の名札を優先して決めるので、どちらの側でも main が一番上にまっすぐ並ぶ。
 */
export function layoutGraph(state: State, side: 'local' | 'remote' = 'local'): GraphLayout {
  const local = state.local?.branches ?? {}
  const remote = state.remote.branches
  const [ownBranches, otherBranches] = side === 'local' ? [local, remote] : [remote, local]
  const visible = new Set([...visibleCommits(state, local), ...visibleCommits(state, remote)])
  const columns = Object.keys(state.commits).filter((id) => visible.has(id))
  const order = new Map(columns.map((id, index) => [id, index]))

  const lanes: Record<string, number> = {}
  /** 段ごとの、いちばん新しいコミット */
  const laneHeads: string[] = []

  /** tip から第1親をたどり、まだ段の決まっていないコミットを lane に置く。置いた先頭のコミットを返す */
  function walk(tip: string, lane: number): { placed: boolean; stoppedAt?: string } {
    let current: string | undefined = tip
    const chain: string[] = []
    while (current !== undefined && lanes[current] === undefined) {
      chain.push(current)
      current = state.commits[current].parents[0]
    }
    if (chain.length === 0) return { placed: false }
    for (const id of chain) lanes[id] = lane
    if (laneHeads[lane] === undefined || order.get(chain[0])! > order.get(laneHeads[lane])!) laneHeads[lane] = chain[0]
    return { placed: true, stoppedAt: current }
  }

  /** 同じ段の続きとして置けるか（途中から枝分かれしていないか） */
  function extendsLane(tip: string, lane: number): boolean {
    let current: string | undefined = tip
    while (current !== undefined && lanes[current] === undefined) current = state.commits[current].parents[0]
    return current === undefined || current === laneHeads[lane]
  }

  const names = [
    MAIN,
    ...Object.keys(ownBranches).filter((name) => name !== MAIN),
    ...Object.keys(otherBranches).filter((name) => name !== MAIN && !(name in ownBranches)),
  ]
  for (const name of names) {
    const tips = [ownBranches[name], otherBranches[name]].filter((tip): tip is string => tip !== undefined)
    let lane: number | undefined
    for (const tip of new Set(tips)) {
      if (lane === undefined) {
        lane = laneHeads.length
        if (!walk(tip, lane).placed) lane = undefined
      } else if (extendsLane(tip, lane)) {
        walk(tip, lane)
      } else {
        // 手元と GitHub で枝分かれしている場合は、つながって見えないよう別の段に置く
        walk(tip, laneHeads.length)
      }
    }
  }

  // 削除されたブランチのコミットなど、どの名札の第1親にもたどれないもの
  for (const id of [...columns].reverse()) {
    if (lanes[id] === undefined) walk(id, laneHeads.length)
  }

  return { columns, lanes, laneCount: laneHeads.length }
}
