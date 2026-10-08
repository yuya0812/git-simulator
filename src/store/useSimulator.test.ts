import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cloneRepo, commit, createBranch, createPullRequest, editFile, push, stageFile, switchBranch } from '../engine'
import { APPROVE_DELAY_MS, useSimulator } from './useSimulator'

const store = () => useSimulator.getState()

/** clone → feature/profile で index.html をコミットして push し、PR を作った状態 */
function openPullRequest() {
  store().run(cloneRepo)
  store().run((s) => createBranch(s, 'feature/profile', { switchTo: true }))
  store().run((s) => editFile(s, 'index.html', 'a'))
  store().run((s) => stageFile(s, 'index.html'))
  store().run((s) => commit(s))
  store().run(push)
  store().run((s) => createPullRequest(s, 'feature/profile'))
}

describe('ストア', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    store().reset()
  })
  afterEach(() => vi.useRealTimers())

  it('PR は少し待つとチームメイトが承認する', () => {
    openPullRequest()
    expect(store().sim.pullRequests[0].status).toBe('open')
    vi.advanceTimersByTime(APPROVE_DELAY_MS)
    expect(store().sim.pullRequests[0].status).toBe('approved')
    expect(store().happened?.did).toContain('承認しました')
  })

  it('確認ダイアログを開いている間に PR が承認されても、確認待ちは消えない', () => {
    openPullRequest()
    store().run((s) => switchBranch(s, 'main'))
    store().run((s) => editFile(s, 'style.css', 'b'))
    store().run((s) => stageFile(s, 'style.css'))
    store().run((s, options) => commit(s, options)) // main へのコミットなので確認待ちになる
    expect(store().pending?.warning.code).toBe('commitOnMain')

    vi.advanceTimersByTime(APPROVE_DELAY_MS)
    expect(store().sim.pullRequests[0].status).toBe('approved')
    expect(store().pending?.warning.code).toBe('commitOnMain')

    store().confirmPending()
    expect(store().pending).toBeNull()
    expect(store().sim.local!.branches.main).toBe('C')
  })

  it('やり直したあとは、前に予約された承認は動かない', () => {
    openPullRequest()
    store().reset()
    openPullRequest()
    vi.advanceTimersByTime(APPROVE_DELAY_MS - 1)
    expect(store().sim.pullRequests[0].status).toBe('open')
  })

  it('同じファイルを編集し続けても、古い説明は残らない', () => {
    store().run(cloneRepo)
    store().run((s) => createBranch(s, 'feature/profile', { switchTo: true }))
    store().run((s) => editFile(s, 'index.html', 'a'))
    store().run((s) => commit(s)) // 何もステージングしていない
    expect(store().explanation?.title).toBe('ステージングに何もありません')
    store().run((s) => editFile(s, 'index.html', 'ab'))
    expect(store().explanation).toBeNull()
  })

  it('ブランチを作っただけなら、移動するか聞く', () => {
    store().run(cloneRepo)
    store().run((s) => createBranch(s, 'feature/profile'))
    expect(store().dialog).toEqual({ type: 'switchAfterCreate', branch: 'feature/profile' })
  })

  it('コマンド入力の結果を履歴に残す', () => {
    store().runCommand('git clone')
    store().runCommand('git log')
    store().runCommand('git status')
    expect(store().commandLog.map((e) => [e.input, e.tone])).toEqual([
      ['git clone', 'ok'],
      ['git log', 'error'],
      ['git status', 'info'],
    ])
  })
})
