import { describe, expect, it } from 'vitest'
import {
  approvePullRequest,
  createInitialState,
  createPullRequest,
  deleteRemoteBranch,
  mergePullRequest,
  push,
  switchBranch,
  teammateUpdate,
} from '../../engine'
import { editStageCommit, expectOk, onFeatureBranch } from '../../engine/testUtils'
import { layoutGraph, visibleCommits } from './layout'

describe('グラフの配置', () => {
  it('初期状態は A だけ', () => {
    expect(layoutGraph(createInitialState())).toEqual({ columns: ['A'], lanes: { A: 0 }, laneCount: 1 })
  })

  it('作業ブランチのコミットは main の下の段に置く', () => {
    const state = editStageCommit(onFeatureBranch(), 'index.html', 'x')
    expect(layoutGraph(state)).toEqual({ columns: ['A', 'B'], lanes: { A: 0, B: 1 }, laneCount: 2 })
  })

  it('PR を merge すると、main はまっすぐ・作業ブランチは下の段のまま', () => {
    let state = expectOk(push(editStageCommit(onFeatureBranch(), 'index.html', 'x')))
    state = expectOk(createPullRequest(state, 'feature/profile'))
    state = expectOk(approvePullRequest(state, 1))
    state = expectOk(mergePullRequest(state, 1)) // C
    expect(layoutGraph(state).lanes).toEqual({ A: 0, B: 1, C: 0 })
  })

  it('GitHub だけが先に進んでいるときは、同じ段の続きに置く', () => {
    const state = expectOk(teammateUpdate(onFeatureBranch())) // GitHub の main だけ B
    expect(layoutGraph(state).lanes).toEqual({ A: 0, B: 0 })
  })

  it('手元と GitHub の main が分かれたら、つながって見えないよう別の段に置く', () => {
    let state = expectOk(switchBranch(onFeatureBranch(), 'main'))
    state = editStageCommit(state, 'index.html', 'mine') // B（手元の main）
    state = expectOk(teammateUpdate(state)) // C（GitHub の main）
    const local = layoutGraph(state, 'local')
    expect(local.lanes).toEqual({ A: 0, B: 0, C: 1 })
    expect(local.columns).toEqual(['A', 'B', 'C'])
    // GitHub 側では、GitHub の main を一番上に置く。列は共通
    const remote = layoutGraph(state, 'remote')
    expect(remote.lanes).toEqual({ A: 0, B: 1, C: 0 })
    expect(remote.columns).toEqual(['A', 'B', 'C'])
  })

  it('どの名札からも第1親でたどれないコミットも、別の段に置く', () => {
    let state = expectOk(push(editStageCommit(onFeatureBranch(), 'index.html', 'x')))
    state = expectOk(createPullRequest(state, 'feature/profile'))
    state = expectOk(approvePullRequest(state, 1))
    state = expectOk(mergePullRequest(state, 1))
    state = expectOk(deleteRemoteBranch(state, 'feature/profile'))
    delete state.local!.branches['feature/profile']
    expect(layoutGraph(state).lanes).toEqual({ A: 0, B: 1, C: 0 })
  })

  it('LOCAL と REMOTE のそれぞれで見えるコミットを求める', () => {
    const state = expectOk(teammateUpdate(onFeatureBranch()))
    expect([...visibleCommits(state, state.local!.branches)]).toEqual(['A'])
    expect([...visibleCommits(state, state.remote.branches)].sort()).toEqual(['A', 'B'])
  })
})
