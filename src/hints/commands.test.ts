import { describe, expect, it } from 'vitest'
import { cloneRepo, commit, createBranch, createInitialState, editFile, push, stageFile, switchBranch, type OpResult, type State } from '../engine'
import { commandForEvent, git } from './commands'

function ok(result: OpResult): { state: State; command: ReturnType<typeof commandForEvent> } {
  if (result.kind !== 'ok') throw new Error(JSON.stringify(result))
  return { state: result.state, command: commandForEvent(result.event, result.state) }
}

describe('本物の Git のコマンド', () => {
  it('操作の流れに沿ったコマンドを返す', () => {
    let step = ok(cloneRepo(createInitialState()))
    expect(step.command.command).toBe('git clone https://github.com/team/profile.git')
    step = ok(createBranch(step.state, 'feature/profile'))
    expect(step.command.command).toBe('git branch feature/profile')
    step = ok(switchBranch(step.state, 'feature/profile'))
    expect(step.command.command).toBe('git switch feature/profile')
    step = ok(editFile(step.state, 'index.html', 'x'))
    expect(step.command.command).toBeUndefined()
    step = ok(stageFile(step.state, 'index.html'))
    expect(step.command.command).toBe('git add index.html')
    step = ok(commit(step.state, { message: '名前を変更' }))
    expect(step.command.command).toBe('git commit -m "名前を変更"')
    step = ok(push(step.state))
    expect(step.command.command).toBe('git push -u origin feature/profile')
  })

  it('2回目の push は git push だけになる', () => {
    let state = ok(createBranch(ok(cloneRepo(createInitialState())).state, 'feature/profile', { switchTo: true })).state
    for (const content of ['a', 'b']) {
      state = ok(editFile(state, 'index.html', content)).state
      state = ok(stageFile(state, 'index.html')).state
      state = ok(commit(state)).state
      if (content === 'a') state = ok(push(state)).state
    }
    expect(ok(push(state)).command.command).toBe('git push')
  })

  it('メッセージの " や $ はエスケープする', () => {
    expect(git.commit('say "hi" $HOME')).toBe('git commit -m "say \\"hi\\" \\$HOME"')
  })
})
