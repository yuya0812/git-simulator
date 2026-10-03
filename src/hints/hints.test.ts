import { describe, expect, it } from 'vitest'
import {
  approvePullRequest,
  cloneRepo,
  commit,
  createBranch,
  createInitialState,
  createPullRequest,
  deleteRemoteBranch,
  editFile,
  mergeLocal,
  mergePullRequest,
  pull,
  push,
  restoreFile,
  stageFile,
  switchBranch,
  teammateUpdate,
  type OpResult,
  type Rejection,
  type State,
  type Warning,
} from '../engine'
import { describeEvent, describeRejection, describeWarning, suggestNext } from '.'

/** 要件 5.2: メインの説明として使わない表現 */
const FORBIDDEN = ['変更を保存', '作業用コピー', 'GitHub に変更を反映', '変更を反映', '変更を送る']

function texts(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(texts)
  if (value && typeof value === 'object') return Object.values(value).flatMap(texts)
  return []
}

function expectReadable(value: unknown) {
  const all = texts(value)
  expect(all.length).toBeGreaterThan(0)
  for (const text of all) {
    for (const phrase of FORBIDDEN) expect(text, text).not.toContain(phrase)
    expect(text, text).not.toMatch(/undefined|null|NaN|\[object/)
  }
}

/** 操作を順に実行し、そのたびにヒントを作って確認する */
function run(state: State, op: (s: State) => OpResult): State {
  const result = op(state)
  if (result.kind !== 'ok') throw new Error(JSON.stringify(result))
  const happened = describeEvent(result.event, result.state)
  expectReadable(happened)
  expectReadable(suggestNext(result.state))
  return result.state
}

describe('今起きたこと', () => {
  it('一周のシナリオで、すべての操作の文章が作れる', () => {
    let s = createInitialState()
    expectReadable(suggestNext(s))
    s = run(s, cloneRepo)
    s = run(s, (x) => createBranch(x, 'feature/profile'))
    s = run(s, (x) => switchBranch(x, 'feature/profile'))
    s = run(s, (x) => editFile(x, 'index.html', 'a'))
    s = run(s, (x) => editFile(x, 'style.css', 'b'))
    s = run(s, (x) => stageFile(x, 'index.html'))
    s = run(s, (x) => commit(x))
    s = run(s, (x) => restoreFile(x, 'style.css'))
    s = run(s, push)
    s = run(s, (x) => createPullRequest(x, 'feature/profile'))
    s = run(s, (x) => approvePullRequest(x, 1))
    s = run(s, (x) => mergePullRequest(x, 1))
    s = run(s, (x) => deleteRemoteBranch(x, 'feature/profile'))
    s = run(s, (x) => switchBranch(x, 'main'))
    s = run(s, pull)
    s = run(s, pull)
    s = run(s, teammateUpdate)
    s = run(s, (x) => createBranch(x, 'feature/two', { switchTo: true }))
    s = run(s, (x) => editFile(x, 'script.js', 'c'))
    s = run(s, (x) => stageFile(x, 'script.js'))
    s = run(s, (x) => commit(x))
    s = run(s, (x) => switchBranch(x, 'main'))
    s = run(s, pull)
    run(s, (x) => mergeLocal(x, 'feature/two', { confirmed: true }))
  })

  it('作った直後のブランチに移動したら、ファイルは変わっていないと伝える', () => {
    let s = run(createInitialState(), cloneRepo)
    s = run(s, (x) => createBranch(x, 'feature/profile'))
    const result = switchBranch(s, 'feature/profile')
    if (result.kind !== 'ok') throw new Error()
    const happened = describeEvent(result.event, result.state)
    expect(happened.note).toContain('ファイルは何も変わっていません')
  })

  it('ステージングしなかったファイルは、変更前の状態で記録されたと伝える', () => {
    let s = run(createInitialState(), cloneRepo)
    s = run(s, (x) => createBranch(x, 'feature/profile', { switchTo: true }))
    s = run(s, (x) => editFile(x, 'index.html', 'a'))
    s = run(s, (x) => editFile(x, 'style.css', 'b'))
    s = run(s, (x) => stageFile(x, 'index.html'))
    const result = commit(s)
    if (result.kind !== 'ok') throw new Error()
    const happened = describeEvent(result.event, result.state)
    expect(happened.note).toContain('style.css はステージングしていないので')
    expect(happened.unchanged).toContain('main（コミット A のまま）')
  })
})

describe('拒否と警告', () => {
  const rejections: Rejection[] = [
    { code: 'alreadyCloned' },
    { code: 'notCloned' },
    { code: 'createBranchFirst' },
    { code: 'invalidBranchName', name: 'a b' },
    { code: 'branchExists', name: 'x' },
    { code: 'branchNotFound', name: 'x' },
    { code: 'alreadyOnBranch', name: 'x' },
    { code: 'uncommittedChanges', files: ['index.html', 'style.css'] },
    { code: 'noChangeToStage', file: 'index.html' },
    { code: 'noChangeToRestore', file: 'index.html' },
    { code: 'nothingStaged' },
    { code: 'mergeSelf', name: 'main' },
    { code: 'alreadyMerged', into: 'main', from: 'x' },
    { code: 'conflict', files: ['index.html'], ours: 'main', theirs: 'x' },
    { code: 'pushUpToDate', branch: 'x' },
    { code: 'pushBehind', branch: 'main' },
    { code: 'noRemoteBranch', branch: 'x' },
    { code: 'prFromMain' },
    { code: 'prNotPushed', branch: 'x' },
    { code: 'prAlreadyOpen', branch: 'x', prId: 1 },
    { code: 'prNothingToMerge', branch: 'x' },
    { code: 'prNotFound', prId: 1 },
    { code: 'prNotApproved', prId: 1 },
    { code: 'prAlreadyMerged', prId: 1 },
    { code: 'cannotDeleteBranch', name: 'main' },
    { code: 'teammateNoFile' },
  ]

  it.each(rejections)('$code の説明が作れる', (rejection) => {
    const explanation = describeRejection(rejection)
    expect(explanation.title).not.toBe('')
    expectReadable(explanation)
  })

  const warnings: Warning[] = [{ code: 'commitOnMain' }, { code: 'pushToMain' }, { code: 'localMerge', into: 'main', from: 'x' }]

  it.each(warnings)('$code の確認文が作れる', (warning) => {
    const message = describeWarning(warning)
    expect(message.confirmLabel).not.toBe('')
    expectReadable(message)
  })
})

describe('次にできること', () => {
  function first(state: State): string {
    return suggestNext(state)[0]
  }

  function ok(result: OpResult): State {
    if (result.kind !== 'ok') throw new Error(JSON.stringify(result))
    return result.state
  }

  it('序盤は clone → ブランチ作成を案内する', () => {
    const initial = createInitialState()
    expect(first(initial)).toContain('clone')
    const cloned = ok(cloneRepo(initial))
    expect(first(cloned)).toContain('ブランチを作ろう')
  })

  it('ブランチを作っただけなら、移動を勧める', () => {
    const s = ok(createBranch(ok(cloneRepo(createInitialState())), 'feature/profile'))
    expect(first(s)).toContain('feature/profile）に移動')
  })

  it('編集 → ステージング → コミット → push → PR の順に案内する', () => {
    let s = ok(createBranch(ok(cloneRepo(createInitialState())), 'feature/profile', { switchTo: true }))
    s = ok(editFile(s, 'index.html', 'a'))
    expect(first(s)).toContain('ステージングに置こう')
    s = ok(stageFile(s, 'index.html'))
    expect(first(s)).toContain('コミットできます')
    s = ok(commit(s))
    expect(first(s)).toContain('push')
    s = ok(push(s))
    expect(first(s)).toContain('PR を作って')
    s = ok(createPullRequest(s, 'feature/profile'))
    expect(first(s)).toContain('承認を待とう')
    s = ok(approvePullRequest(s, 1))
    expect(first(s)).toContain('merge しよう')
    s = ok(mergePullRequest(s, 1))
    expect(suggestNext(s)).toContain('GitHub の main が進んでいます。main に移動して pull しよう')
  })

  it('チームメイトに先を越されたら pull を勧める', () => {
    let s = ok(createBranch(ok(cloneRepo(createInitialState())), 'feature/profile'))
    s = ok(teammateUpdate(s))
    expect(first(s)).toContain('pull して最新に')
  })
})
