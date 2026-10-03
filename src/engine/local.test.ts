import { describe, expect, it } from 'vitest'
import { conflictingFiles, isAncestor, mergeBase, mergeFiles } from './graph'
import { commitIdFromIndex, createInitialState, INITIAL_FILES } from './initial'
import {
  cloneRepo,
  commit,
  createBranch,
  defaultCommitMessage,
  editFile,
  isValidBranchName,
  mergeLocal,
  restoreFile,
  stageFile,
  switchBranch,
} from './operations/local'
import type { State } from './types'
import { editStageCommit, expectOk, onFeatureBranch, rejectionCode } from './testUtils'

describe('コミット ID', () => {
  it('作られた順に A, B, C... と振る', () => {
    expect([0, 1, 25, 26, 27].map(commitIdFromIndex)).toEqual(['A', 'B', 'Z', 'AA', 'AB'])
  })
})

describe('序盤の固定手順', () => {
  it('clone 前はリモートにだけ main がある', () => {
    const state = createInitialState()
    expect(state.local).toBeNull()
    expect(state.remote.branches).toEqual({ main: 'A' })
  })

  it('clone 前は他の操作ができない', () => {
    const state = createInitialState()
    expect(rejectionCode(createBranch(state, 'feature/profile'))).toBe('notCloned')
    expect(rejectionCode(editFile(state, 'index.html', 'x'))).toBe('notCloned')
  })

  it('clone するとローカルに main と全ファイルがコピーされる', () => {
    const state = expectOk(cloneRepo(createInitialState()))
    expect(state.local?.branches).toEqual({ main: 'A' })
    expect(state.local?.workingTree).toEqual(INITIAL_FILES)
    expect(state.phase).toBe('beforeBranch')
    expect(rejectionCode(cloneRepo(state))).toBe('alreadyCloned')
  })

  it('ブランチを作るまでは編集できない', () => {
    const state = expectOk(cloneRepo(createInitialState()))
    expect(rejectionCode(editFile(state, 'index.html', 'x'))).toBe('createBranchFirst')
  })

  it('ブランチを作ると自由に操作できるようになる', () => {
    const state = onFeatureBranch()
    expect(state.phase).toBe('free')
  })
})

describe('ブランチ作成', () => {
  it('作った直後は main と同じコミットを指す', () => {
    const state = onFeatureBranch()
    expect(state.local?.branches).toEqual({ main: 'A', 'feature/profile': 'A' })
    expect(state.local?.current).toBe('feature/profile')
  })

  it('switchTo を指定しなければ今のブランチに残る', () => {
    const cloned = expectOk(cloneRepo(createInitialState()))
    const state = expectOk(createBranch(cloned, 'feature/profile'))
    expect(state.local?.current).toBe('main')
  })

  it('使えない名前と重複を止める', () => {
    const state = onFeatureBranch()
    expect(rejectionCode(createBranch(state, 'feature/profile'))).toBe('branchExists')
    for (const name of ['', 'a b', '/x', 'x/', 'a..b', 'a//b', 'x.', 'ブランチ']) {
      expect(isValidBranchName(name)).toBe(false)
    }
    expect(isValidBranchName('feature/my-page_2')).toBe(true)
  })
})

describe('編集・ステージング・コミット', () => {
  it('ステージングしたファイルだけが変わり、他は古いまま記録される', () => {
    let state = onFeatureBranch()
    state = expectOk(editFile(state, 'index.html', 'new html'))
    state = expectOk(editFile(state, 'style.css', 'new css'))
    state = expectOk(stageFile(state, 'index.html'))
    expect(defaultCommitMessage(state)).toBe('index.html を変更')

    const result = commit(state)
    const next = expectOk(result)
    const id = next.local!.branches['feature/profile']
    expect(id).toBe('B')
    expect(next.commits.B.parents).toEqual(['A'])
    expect(next.commits.B.message).toBe('index.html を変更')
    expect(next.commits.B.files).toEqual({ ...INITIAL_FILES, 'index.html': 'new html' })
    // style.css は編集中のまま残る
    expect(next.local!.workingTree['style.css']).toBe('new css')
    expect(result.kind === 'ok' && result.event).toMatchObject({ changedFiles: ['index.html'], leftUnstaged: ['style.css'] })
    // main はまだ A のまま
    expect(next.local!.branches.main).toBe('A')
  })

  it('入力したメッセージを使う', () => {
    const state = editStageCommit(onFeatureBranch(), 'index.html', 'x', '名前を変えた')
    expect(state.commits.B.message).toBe('名前を変えた')
  })

  it('何もステージングしていなければコミットしない', () => {
    expect(rejectionCode(commit(onFeatureBranch()))).toBe('nothingStaged')
  })

  it('変更のないファイルはステージングしない', () => {
    expect(rejectionCode(stageFile(onFeatureBranch(), 'index.html'))).toBe('noChangeToStage')
  })

  it('main でのコミットは確認を挟む', () => {
    const cloned = expectOk(cloneRepo(createInitialState()))
    let state = expectOk(createBranch(cloned, 'feature/profile'))
    state = expectOk(editFile(state, 'index.html', 'x'))
    state = expectOk(stageFile(state, 'index.html'))
    expect(commit(state)).toEqual({ kind: 'needsConfirm', warning: { code: 'commitOnMain' } })
    expect(expectOk(commit(state, { confirmed: true })).local!.branches.main).toBe('B')
  })
})

describe('restore', () => {
  it('編集中とステージングの両方を、最後のコミットの内容に戻す', () => {
    let state = onFeatureBranch()
    state = expectOk(editFile(state, 'index.html', 'x'))
    state = expectOk(stageFile(state, 'index.html'))
    state = expectOk(restoreFile(state, 'index.html'))
    expect(state.local!.workingTree['index.html']).toBe(INITIAL_FILES['index.html'])
    expect(state.local!.index['index.html']).toBe(INITIAL_FILES['index.html'])
  })

  it('変更がなければ何もしない', () => {
    expect(rejectionCode(restoreFile(onFeatureBranch(), 'index.html'))).toBe('noChangeToRestore')
  })
})

describe('ブランチ切り替え', () => {
  it('切り替えるとファイルもそのブランチの状態になる', () => {
    const state = editStageCommit(onFeatureBranch(), 'index.html', 'feature html')
    const onMain = expectOk(switchBranch(state, 'main'))
    expect(onMain.local!.workingTree['index.html']).toBe(INITIAL_FILES['index.html'])
    const back = expectOk(switchBranch(onMain, 'feature/profile'))
    expect(back.local!.workingTree['index.html']).toBe('feature html')
  })

  it('作った直後のブランチへの移動では、ファイルは何も変わらない', () => {
    const cloned = expectOk(cloneRepo(createInitialState()))
    const created = expectOk(createBranch(cloned, 'feature/profile'))
    const result = switchBranch(created, 'feature/profile')
    expect(result.kind === 'ok' && result.event).toEqual({
      type: 'switched',
      from: 'main',
      to: 'feature/profile',
      fromCommit: 'A',
      at: 'A',
      changedFiles: [],
    })
  })

  it('移動前後で中身が変わったファイルを伝える', () => {
    const state = editStageCommit(onFeatureBranch(), 'index.html', 'feature html')
    const result = switchBranch(state, 'main')
    expect(result.kind === 'ok' && result.event).toMatchObject({ fromCommit: 'B', at: 'A', changedFiles: ['index.html'] })
  })

  it('コミットしていない変更があれば止める', () => {
    const state = expectOk(editFile(onFeatureBranch(), 'style.css', 'x'))
    const result = switchBranch(state, 'main')
    expect(result).toEqual({ kind: 'rejected', rejection: { code: 'uncommittedChanges', files: ['style.css'] } })
  })

  it('存在しないブランチと今いるブランチは止める', () => {
    const state = onFeatureBranch()
    expect(rejectionCode(switchBranch(state, 'nope'))).toBe('branchNotFound')
    expect(rejectionCode(switchBranch(state, 'feature/profile'))).toBe('alreadyOnBranch')
  })
})

describe('グラフの判定', () => {
  it('祖先と共通祖先を求める', () => {
    let state = editStageCommit(onFeatureBranch(), 'index.html', 'b') // B
    state = expectOk(switchBranch(state, 'main'))
    state = editStageCommit(state, 'style.css', 'c') // C (main)
    expect(isAncestor(state.commits, 'A', 'B')).toBe(true)
    expect(isAncestor(state.commits, 'B', 'C')).toBe(false)
    expect(mergeBase(state.commits, 'B', 'C')).toBe('A')
    expect(conflictingFiles(state.commits, 'B', 'C')).toEqual([])
    expect(mergeFiles(state.commits, 'B', 'C')).toEqual({ ...INITIAL_FILES, 'index.html': 'b', 'style.css': 'c' })
  })
})

describe('ローカル merge', () => {
  /** feature で index.html、main で style.css を変更した状態（main にいる） */
  function diverged(): State {
    let state = editStageCommit(onFeatureBranch(), 'index.html', 'feature html')
    state = expectOk(switchBranch(state, 'main'))
    return editStageCommit(state, 'style.css', 'main css')
  }

  it('確認を挟んでからマージコミットを作る', () => {
    const state = diverged()
    expect(mergeLocal(state, 'feature/profile')).toEqual({
      kind: 'needsConfirm',
      warning: { code: 'localMerge', into: 'main', from: 'feature/profile' },
    })
    const merged = expectOk(mergeLocal(state, 'feature/profile', { confirmed: true }))
    const id = merged.local!.branches.main
    expect(merged.commits[id].parents).toEqual(['C', 'B'])
    expect(merged.commits[id].files).toEqual({ ...INITIAL_FILES, 'index.html': 'feature html', 'style.css': 'main css' })
    expect(merged.local!.workingTree).toEqual(merged.commits[id].files)
  })

  it('fast-forward できる場面でもマージコミットを作る', () => {
    let state = editStageCommit(onFeatureBranch(), 'index.html', 'x')
    state = expectOk(switchBranch(state, 'main'))
    const merged = expectOk(mergeLocal(state, 'feature/profile', { confirmed: true }))
    expect(merged.commits[merged.local!.branches.main].parents).toEqual(['A', 'B'])
  })

  it('同じファイルを両側で変更していたら Conflict として止める', () => {
    let state = editStageCommit(onFeatureBranch(), 'index.html', 'feature')
    state = expectOk(switchBranch(state, 'main'))
    state = editStageCommit(state, 'index.html', 'main')
    expect(mergeLocal(state, 'feature/profile', { confirmed: true })).toEqual({
      kind: 'rejected',
      rejection: { code: 'conflict', files: ['index.html'], ours: 'main', theirs: 'feature/profile' },
    })
  })

  it('取り込み済み・自分自身・未コミットの変更ありは止める', () => {
    const state = diverged()
    const merged = expectOk(mergeLocal(state, 'feature/profile', { confirmed: true }))
    expect(rejectionCode(mergeLocal(merged, 'feature/profile', { confirmed: true }))).toBe('alreadyMerged')
    expect(rejectionCode(mergeLocal(state, 'main'))).toBe('mergeSelf')
    const dirty = expectOk(editFile(state, 'script.js', 'x'))
    expect(rejectionCode(mergeLocal(dirty, 'feature/profile'))).toBe('uncommittedChanges')
  })
})
