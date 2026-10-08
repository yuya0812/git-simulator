import { describe, expect, it } from 'vitest'
import { createInitialState, editFile, type OpResult, type State } from '../engine'
import { expectOk, onFeatureBranch } from '../engine/testUtils'
import { parseCommand, tokenize, type ParsedCommand } from './parse'

/** コマンドを実行して、エンジンの結果を返す */
function runCommand(input: string, state: State, confirmed = false): OpResult {
  const parsed = parseCommand(input, state)
  if (parsed.type !== 'run') throw new Error(`run を期待したが ${JSON.stringify(parsed)}`)
  return parsed.operation(state, { confirmed })
}

function lines(parsed: ParsedCommand): string[] {
  return parsed.type === 'output' || parsed.type === 'error' ? parsed.lines : []
}

describe('tokenize', () => {
  it('引用符で囲んだ部分を1つにまとめる', () => {
    expect(tokenize('git commit -m "名前 を 変更"')).toEqual(['git', 'commit', '-m', '名前 を 変更'])
    expect(tokenize("git commit -m '一言'")).toEqual(['git', 'commit', '-m', '一言'])
    expect(tokenize('git commit -m "say \\"hi\\""')).toEqual(['git', 'commit', '-m', 'say "hi"'])
  })
})

describe('コマンドで一周する', () => {
  it('ボタンと同じ結果になる', () => {
    let state = expectOk(runCommand('git clone https://github.com/team/profile.git', createInitialState()))
    state = expectOk(runCommand('git branch feature/profile', state))
    expect(state.local!.current).toBe('main')
    state = expectOk(runCommand('git switch feature/profile', state))
    state = expectOk(editFile(state, 'index.html', 'a'))
    state = expectOk(editFile(state, 'style.css', 'b'))
    state = expectOk(runCommand('git add .', state))
    expect(state.local!.index['index.html']).toBe('a')
    expect(state.local!.index['style.css']).toBe('b')
    state = expectOk(runCommand('git commit -m "名前と色を変更"', state))
    expect(state.commits.B.message).toBe('名前と色を変更')
    state = expectOk(runCommand('git push -u origin feature/profile', state))
    expect(state.remote.branches['feature/profile']).toBe('B')
  })

  it('git add は複数のファイルを指定できる', () => {
    let state = expectOk(editFile(onFeatureBranch(), 'index.html', 'a'))
    state = expectOk(editFile(state, 'script.js', 'c'))
    state = expectOk(runCommand('git add index.html script.js', state))
    expect(state.local!.index['script.js']).toBe('c')
  })

  it('git checkout は git switch と同じ', () => {
    const parsed = parseCommand('git checkout main', onFeatureBranch())
    expect(parsed.type === 'run' && parsed.note).toContain('git switch')
    expect(expectOk(runCommand('git checkout main', onFeatureBranch())).local!.current).toBe('main')
  })

  it('エンジンの拒否や確認は、ボタンと同じように返る', () => {
    expect(runCommand('git commit -m x', onFeatureBranch())).toMatchObject({ kind: 'rejected', rejection: { code: 'nothingStaged' } })
    let state = expectOk(runCommand('git switch main', onFeatureBranch()))
    state = expectOk(editFile(state, 'index.html', 'a'))
    state = expectOk(runCommand('git add index.html', state))
    expect(runCommand('git commit -m x', state)).toEqual({ kind: 'needsConfirm', warning: { code: 'commitOnMain' } })
    expect(runCommand('git commit -m x', state, true).kind).toBe('ok')
  })
})

describe('表示だけのコマンド', () => {
  it('git status で今の状態を文字で出す', () => {
    const state = expectOk(editFile(onFeatureBranch(), 'index.html', 'a'))
    expect(lines(parseCommand('git status', state))).toEqual([
      'ブランチ feature/profile にいます',
      'feature/profile はまだ GitHub にありません。',
      '編集中（まだステージングしていない）: index.html',
    ])
  })

  it('git branch だけならブランチの一覧を出す', () => {
    expect(lines(parseCommand('git branch', onFeatureBranch()))).toEqual(['  main', '* feature/profile'])
  })

  it('git diff は Diff の画面を開く', () => {
    expect(parseCommand('git diff', onFeatureBranch())).toEqual({ type: 'dialog', dialog: { type: 'diffWorking' } })
    expect(parseCommand('git diff a b', expectOk(runCommand('git commit -m x', expectOk(runCommand('git add .', expectOk(editFile(onFeatureBranch(), 'index.html', 'z')))))))).toEqual({
      type: 'dialog',
      dialog: { type: 'diffCommits', from: 'A', to: 'B' },
    })
  })

  it('何も変更がなければ git add . はそう伝える', () => {
    expect(lines(parseCommand('git add .', onFeatureBranch()))).toEqual(['ステージングする変更はありません。'])
  })
})

describe('使えないコマンド', () => {
  it.each([
    ['ls', 'git から始まるコマンド'],
    ['git log', 'git log はこのアプリでは使えません'],
    ['git rebase main', 'git rebase はこのアプリでは使えません'],
    ['git switch -c feature/x', 'git branch feature/x で作ってから'],
    ['git commit', '-m で付けて'],
    ['git add nope.txt', 'nope.txt というファイルはありません'],
    ['git push upstream', 'origin（GitHub）だけ'],
    ['git clone https://example.com/x.git', 'clone できるのは'],
    ['git diff A Z', 'コミット Z はありません'],
  ])('%s', (input, expected) => {
    const parsed = parseCommand(input, onFeatureBranch())
    expect(parsed.type).toBe('error')
    expect(lines(parsed).join('\n')).toContain(expected)
  })

  it('今いるブランチ以外は push できない', () => {
    const parsed = parseCommand('git push origin main', onFeatureBranch())
    expect(lines(parsed).join()).toContain('今いるブランチ（feature/profile）だけ')
  })
})
