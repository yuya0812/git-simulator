import { describe, expect, it } from 'vitest'
import { INITIAL_FILES } from './initial'
import {
  approvePullRequest,
  createPullRequest,
  deleteRemoteBranch,
  mergePullRequest,
  teammateUpdate,
} from './operations/github'
import { createBranch, editFile, switchBranch } from './operations/local'
import { pull, push } from './operations/remote'
import { userChangedFiles } from './repo'
import { editStageCommit, expectOk, onFeatureBranch, rejectionCode } from './testUtils'
import type { State } from './types'

/** feature/profile で index.html を変更してコミットし、push した状態 */
function pushedFeature(): State {
  const committed = editStageCommit(onFeatureBranch(), 'index.html', 'feature html')
  return expectOk(push(committed))
}

/** pushedFeature から PR を作って承認した状態 */
function approvedPr(): State {
  const created = expectOk(createPullRequest(pushedFeature(), 'feature/profile'))
  return expectOk(approvePullRequest(created, 1))
}

describe('push', () => {
  it('新しいブランチをリモートに作り、main は変えない', () => {
    const committed = editStageCommit(onFeatureBranch(), 'index.html', 'x')
    const result = push(committed)
    expect(result.kind === 'ok' && result.event).toEqual({
      type: 'pushed',
      branch: 'feature/profile',
      created: true,
      sentCommitIds: ['B'],
    })
    const state = expectOk(result)
    expect(state.remote.branches).toEqual({ main: 'A', 'feature/profile': 'B' })
  })

  it('同じなら送らない', () => {
    expect(rejectionCode(push(pushedFeature()))).toBe('pushUpToDate')
  })

  it('main への push は確認を挟む', () => {
    let state = expectOk(switchBranch(onFeatureBranch(), 'main'))
    state = editStageCommit(state, 'index.html', 'x')
    expect(push(state)).toEqual({ kind: 'needsConfirm', warning: { code: 'pushToMain' } })
    expect(expectOk(push(state, { confirmed: true })).remote.branches.main).toBe('B')
  })

  it('リモートの方が先に進んでいたら拒否する', () => {
    let state = expectOk(teammateUpdate(onFeatureBranch()))
    state = expectOk(switchBranch(state, 'main'))
    state = editStageCommit(state, 'script.js', 'mine')
    expect(rejectionCode(push(state, { confirmed: true }))).toBe('pushBehind')
  })
})

describe('pull', () => {
  it('リモートにないブランチでは止める', () => {
    expect(rejectionCode(pull(onFeatureBranch()))).toBe('noRemoteBranch')
  })

  it('最新なら何も変えない', () => {
    const state = expectOk(switchBranch(onFeatureBranch(), 'main'))
    const result = pull(state)
    expect(result.kind === 'ok' && result.event).toMatchObject({ mode: 'upToDate' })
  })

  it('手元が進んでいなければ名札を動かすだけ（fast-forward）', () => {
    let state = expectOk(teammateUpdate(onFeatureBranch())) // B (index.html を変更)
    state = expectOk(switchBranch(state, 'main'))
    const result = pull(state)
    expect(result.kind === 'ok' && result.event).toEqual({
      type: 'pulled',
      branch: 'main',
      mode: 'fastForward',
      receivedCommitIds: ['B'],
    })
    const pulled = expectOk(result)
    expect(pulled.local!.branches.main).toBe('B')
    expect(pulled.local!.workingTree).toEqual(pulled.commits.B.files)
  })

  it('両方進んでいればマージコミットを作る', () => {
    let state = expectOk(switchBranch(onFeatureBranch(), 'main'))
    state = editStageCommit(state, 'index.html', 'mine') // B (local main)
    state = expectOk(teammateUpdate(state)) // C (remote main, index.html 以外)
    const result = pull(state)
    const pulled = expectOk(result)
    const id = pulled.local!.branches.main
    expect(result.kind === 'ok' && result.event).toMatchObject({ mode: 'merge', id, receivedCommitIds: ['C'] })
    expect(pulled.commits[id].parents).toEqual(['B', 'C'])
    expect(pulled.commits[id].files['index.html']).toBe('mine')
    expect(pulled.commits[id].files['style.css']).toBe(pulled.commits.C.files['style.css'])
    expect(expectOk(push(pulled, { confirmed: true })).remote.branches.main).toBe(id)
  })

  it('未コミットの変更があれば止める', () => {
    let state = expectOk(switchBranch(onFeatureBranch(), 'main'))
    state = expectOk(editFile(state, 'index.html', 'x'))
    expect(rejectionCode(pull(state))).toBe('uncommittedChanges')
  })
})

describe('PR', () => {
  it('main・未 push・重複・取り込むものなしは作れない', () => {
    const state = pushedFeature()
    expect(rejectionCode(createPullRequest(state, 'main'))).toBe('prFromMain')
    expect(rejectionCode(createPullRequest(onFeatureBranch(), 'feature/profile'))).toBe('prNotPushed')
    const created = expectOk(createPullRequest(state, 'feature/profile'))
    expect(rejectionCode(createPullRequest(created, 'feature/profile'))).toBe('prAlreadyOpen')

    let empty = expectOk(createBranch(onFeatureBranch(), 'feature/empty', { switchTo: true }))
    empty = expectOk(push(empty))
    expect(rejectionCode(createPullRequest(empty, 'feature/empty'))).toBe('prNothingToMerge')
  })

  it('承認されるまで merge できない', () => {
    const created = expectOk(createPullRequest(pushedFeature(), 'feature/profile'))
    expect(created.pullRequests[0].status).toBe('open')
    expect(rejectionCode(mergePullRequest(created, 1))).toBe('prNotApproved')
  })

  it('merge すると GitHub の main にマージコミットができ、手元の main は変わらない', () => {
    const merged = expectOk(mergePullRequest(approvedPr(), 1))
    const id = merged.remote.branches.main
    expect(id).toBe('C')
    expect(merged.commits.C.parents).toEqual(['A', 'B'])
    expect(merged.commits.C.message).toBe('Merge pull request #1 from feature/profile')
    expect(merged.pullRequests[0]).toMatchObject({ status: 'merged', mergeCommit: 'C' })
    expect(merged.local!.branches.main).toBe('A')
    expect(rejectionCode(mergePullRequest(merged, 1))).toBe('prAlreadyMerged')
  })

  it('同じファイルを main でも変更されていたら Conflict として止める', () => {
    let state = expectOk(teammateUpdate(onFeatureBranch())) // index.html を変更
    state = editStageCommit(state, 'index.html', 'mine')
    state = expectOk(push(state))
    state = expectOk(createPullRequest(state, 'feature/profile'))
    state = expectOk(approvePullRequest(state, 1))
    expect(rejectionCode(mergePullRequest(state, 1))).toBe('conflict')
  })
})

describe('リモートブランチの削除', () => {
  it('merge 済みの PR のブランチだけ削除できる', () => {
    const approved = approvedPr()
    expect(rejectionCode(deleteRemoteBranch(approved, 'feature/profile'))).toBe('cannotDeleteBranch')
    const merged = expectOk(mergePullRequest(approved, 1))
    expect(rejectionCode(deleteRemoteBranch(merged, 'main'))).toBe('cannotDeleteBranch')
    const deleted = expectOk(deleteRemoteBranch(merged, 'feature/profile'))
    expect(deleted.remote.branches).toEqual({ main: 'C' })
    // コミットは消えず、ローカルのブランチも残る
    expect(deleted.commits.B).toBeDefined()
    expect(deleted.local!.branches['feature/profile']).toBe('B')
  })
})

describe('チームメイト', () => {
  it('ユーザーが変更していないファイルだけを変更する', () => {
    let state = editStageCommit(onFeatureBranch(), 'index.html', 'mine')
    state = expectOk(editFile(state, 'style.css', 'editing'))
    expect(userChangedFiles(state)).toEqual(['index.html', 'style.css'])
    const result = teammateUpdate(state)
    expect(result.kind === 'ok' && result.event).toMatchObject({ type: 'teammateCommitted', file: 'script.js' })
  })

  it('3つとも変更済みなら止める', () => {
    let state = onFeatureBranch()
    for (const file of ['index.html', 'style.css', 'script.js'] as const) {
      state = expectOk(editFile(state, file, 'x'))
    }
    expect(rejectionCode(teammateUpdate(state))).toBe('teammateNoFile')
  })

  it('GitHub の main に取り込まれたファイルは、また変更できる', () => {
    const merged = expectOk(mergePullRequest(approvedPr(), 1))
    expect(userChangedFiles(merged)).toEqual([])
  })

  it('毎回違うファイルから選び始め、変更内容に回数が入る', () => {
    let state = expectOk(teammateUpdate(onFeatureBranch()))
    state = expectOk(teammateUpdate(state))
    const first = state.commits.B
    const second = state.commits.C
    expect(first.files['index.html']).toContain('1回目')
    expect(second.files['style.css']).toContain('2回目')
    expect(second.files['index.html']).toBe(first.files['index.html'])
    expect(second.author).toBe('teammate')
  })
})

describe('シナリオ', () => {
  it('clone から pull まで一周する', () => {
    let state = pushedFeature() // B
    state = expectOk(createPullRequest(state, 'feature/profile'))
    state = expectOk(approvePullRequest(state, 1))
    state = expectOk(mergePullRequest(state, 1)) // C
    state = expectOk(deleteRemoteBranch(state, 'feature/profile'))
    state = expectOk(switchBranch(state, 'main'))
    // GitHub で merge しても、手元の main は古いまま
    expect(state.local!.workingTree['index.html']).toBe(INITIAL_FILES['index.html'])
    state = expectOk(pull(state))
    expect(state.local!.branches.main).toBe('C')
    expect(state.local!.workingTree['index.html']).toBe('feature html')
  })

  it('チームメイトに先を越されたら、pull してから push する', () => {
    let state = expectOk(switchBranch(onFeatureBranch(), 'main'))
    state = editStageCommit(state, 'index.html', 'mine') // B
    state = expectOk(teammateUpdate(state)) // C
    expect(rejectionCode(push(state, { confirmed: true }))).toBe('pushBehind')
    state = expectOk(pull(state)) // D = merge(B, C)
    state = expectOk(push(state, { confirmed: true }))
    expect(state.remote.branches.main).toBe('D')
  })
})
