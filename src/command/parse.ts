import {
  changedFiles,
  cloneRepo,
  commit,
  createBranch,
  FILE_NAMES,
  headFiles,
  isAncestor,
  mergeLocal,
  pull,
  push,
  restoreFile,
  stageFile,
  switchBranch,
  type ConfirmOption,
  type FileName,
  type OpResult,
  type State,
} from '../engine'
import { REPOSITORY_URL } from '../hints'
import type { Dialog } from '../store/useSimulator'

type Operation = (state: State, options: ConfirmOption) => OpResult

/** 入力したコマンドを、どう扱うか */
export type ParsedCommand =
  /** ボタンと同じエンジン操作を実行する */
  | { type: 'run'; operation: Operation; note?: string }
  /** 状態を文字で表示する（git status など） */
  | { type: 'output'; lines: string[] }
  /** 画面を開く（git diff） */
  | { type: 'dialog'; dialog: Dialog }
  /** 実行しない。理由を表示する */
  | { type: 'error'; lines: string[] }

/** "..." や '...' で囲まれた部分を1つの引数として扱う */
export function tokenize(input: string): string[] {
  const tokens: string[] = []
  const pattern = /"((?:\\.|[^"\\])*)"|'([^']*)'|(\S+)/g
  for (const match of input.matchAll(pattern)) {
    if (match[1] !== undefined) tokens.push(match[1].replace(/\\(.)/g, '$1'))
    else if (match[2] !== undefined) tokens.push(match[2])
    else tokens.push(match[3])
  }
  return tokens
}

const SUPPORTED = [
  'git clone',
  'git branch <ブランチ名>',
  'git switch <ブランチ名>',
  'git add <ファイル名> / git add .',
  'git restore <ファイル名>',
  'git commit -m "<メッセージ>"',
  'git merge <ブランチ名>',
  'git push',
  'git pull',
  'git status',
  'git diff / git diff <コミット> <コミット>',
]

const unsupported = (detail: string): ParsedCommand => ({
  type: 'error',
  lines: [detail, 'help と入力すると、使えるコマンドの一覧を見られます。'],
})

const isFileName = (name: string): name is FileName => (FILE_NAMES as readonly string[]).includes(name)

/** 編集中のファイルをまとめてステージングする（git add .） */
function stageAll(state: State): OpResult {
  const local = state.local
  // clone 前などは、エンジンに理由を説明させる
  if (!local) return stageFile(state, FILE_NAMES[0])
  let result: OpResult = stageFile(state, FILE_NAMES[0])
  let current = state
  for (const file of changedFiles(local.index, local.workingTree)) {
    result = stageFile(current, file)
    if (result.kind !== 'ok') return result
    current = result.state
  }
  return result
}

/** 入力したコマンドを、エンジンの操作や表示に変換する */
export function parseCommand(input: string, state: State): ParsedCommand {
  const tokens = tokenize(input.trim())
  if (tokens.length === 0) return { type: 'error', lines: [] }
  if (tokens[0] === 'help') return { type: 'output', lines: ['このアプリで使えるコマンド:', ...SUPPORTED.map((c) => `  ${c}`)] }
  if (tokens[0] !== 'git') return unsupported(`「${tokens[0]}」はこのアプリでは使えません。git から始まるコマンドを入力してください。`)

  const [, sub, ...args] = tokens
  const positional = args.filter((arg) => !arg.startsWith('-'))
  const flags = args.filter((arg) => arg.startsWith('-'))

  switch (sub) {
    case 'clone':
      if (positional[0] && positional[0] !== REPOSITORY_URL) {
        return { type: 'error', lines: [`このアプリで clone できるのは ${REPOSITORY_URL} だけです。`] }
      }
      return { type: 'run', operation: cloneRepo }

    case 'branch':
      if (positional.length === 0) return { type: 'output', lines: branchList(state) }
      if (flags.length > 0) return unsupported(`git branch ${flags.join(' ')} はこのアプリでは使えません。`)
      return { type: 'run', operation: (s) => createBranch(s, positional[0]) }

    case 'switch':
    case 'checkout':
      if (flags.includes('-c') || flags.includes('-b')) {
        return {
          type: 'error',
          lines: [
            `このアプリでは、ブランチを「作る」と「移動する」を分けて体験します。`,
            `git branch ${positional[0] ?? '<ブランチ名>'} で作ってから、git switch ${positional[0] ?? '<ブランチ名>'} で移動してください。`,
          ],
        }
      }
      if (!positional[0]) return { type: 'error', lines: [`移動先のブランチ名を指定してください（例: git ${sub} main）`] }
      return {
        type: 'run',
        operation: (s) => switchBranch(s, positional[0]),
        note: sub === 'checkout' ? 'git checkout でも移動できます。今は git switch を使うのがおすすめです' : undefined,
      }

    case 'add':
      if (positional.length === 0) return { type: 'error', lines: ['ステージングするファイルを指定してください（例: git add index.html / git add .）'] }
      if (positional.includes('.') || flags.includes('-A') || flags.includes('--all')) {
        const local = state.local
        if (local && state.phase === 'free' && changedFiles(local.index, local.workingTree).length === 0) {
          return { type: 'output', lines: ['ステージングする変更はありません。'] }
        }
        return { type: 'run', operation: stageAll }
      }
      return fileOperation(positional, (s, file) => stageFile(s, file))

    case 'restore':
      if (positional.length === 0) return { type: 'error', lines: ['元に戻すファイルを指定してください（例: git restore index.html）'] }
      return fileOperation(positional, (s, file) => restoreFile(s, file))

    case 'commit': {
      const index = args.findIndex((arg) => arg === '-m' || arg === '--message')
      if (index === -1 || args[index + 1] === undefined) {
        return { type: 'error', lines: ['このアプリでは、メッセージを -m で付けてください（例: git commit -m "名前を変更"）'] }
      }
      const message = args[index + 1]
      return { type: 'run', operation: (s, options) => commit(s, { ...options, message }) }
    }

    case 'merge':
      if (!positional[0]) return { type: 'error', lines: ['取り込むブランチ名を指定してください（例: git merge feature/profile）'] }
      return { type: 'run', operation: (s, options) => mergeLocal(s, positional[0], options) }

    case 'push':
    case 'pull': {
      const branch = positional[1]
      const current = state.local?.current
      if (positional[0] && positional[0] !== 'origin') {
        return { type: 'error', lines: [`このアプリのリモートは origin（GitHub）だけです。`] }
      }
      if (branch && current && branch !== current) {
        return { type: 'error', lines: [`このアプリでは、今いるブランチ（${current}）だけを ${sub} できます。先に git switch ${branch} で移動してください。`] }
      }
      return { type: 'run', operation: sub === 'push' ? push : (s) => pull(s) }
    }

    case 'status':
      return { type: 'output', lines: statusLines(state) }

    case 'diff':
      if (positional.length >= 2) {
        const [from, to] = positional.map((id) => id.toUpperCase())
        const missing = [from, to].filter((id) => !state.commits[id])
        if (missing.length > 0) return { type: 'error', lines: [`コミット ${missing.join('、')} はありません。`] }
        return { type: 'dialog', dialog: { type: 'diffCommits', from, to } }
      }
      if (!state.local) return { type: 'error', lines: ['まだ clone していないので、比べるものがありません。'] }
      return { type: 'dialog', dialog: { type: 'diffWorking' } }

    case undefined:
      return unsupported('git のあとにコマンドを入力してください。')

    default:
      return unsupported(`git ${sub} はこのアプリでは使えません。`)
  }
}

function fileOperation(names: string[], op: (state: State, file: FileName) => OpResult): ParsedCommand {
  const unknown = names.filter((name) => !isFileName(name))
  if (unknown.length > 0) {
    return { type: 'error', lines: [`${unknown.join('、')} というファイルはありません。ファイルは ${FILE_NAMES.join(' / ')} の3つです。`] }
  }
  return {
    type: 'run',
    operation: (state) => {
      let result: OpResult = op(state, names[0] as FileName)
      for (const name of names.slice(1)) {
        if (result.kind !== 'ok') return result
        result = op(result.state, name as FileName)
      }
      return result
    },
  }
}

function branchList(state: State): string[] {
  const local = state.local
  if (!local) return ['まだ clone していないので、自分のPCにはブランチがありません。']
  return Object.keys(local.branches).map((name) => `${name === local.current ? '* ' : '  '}${name}`)
}

function statusLines(state: State): string[] {
  const local = state.local
  if (!local) return ['まだ clone していません。']
  const head = headFiles(state, local)
  const staged = changedFiles(head, local.index)
  const editing = changedFiles(local.index, local.workingTree)
  const localTip = local.branches[local.current]
  const remoteTip = state.remote.branches[local.current]

  let sync: string
  if (!remoteTip) sync = `${local.current} はまだ GitHub にありません。`
  else if (remoteTip === localTip) sync = `GitHub の ${local.current} と同じ状態です。`
  else if (isAncestor(state.commits, remoteTip, localTip)) sync = `GitHub の ${local.current} より進んでいます（push すると送れます）。`
  else if (isAncestor(state.commits, localTip, remoteTip)) sync = `GitHub の ${local.current} の方が進んでいます（pull すると取り込めます）。`
  else sync = `GitHub の ${local.current} と分かれています（pull してから push しましょう）。`

  return [
    `ブランチ ${local.current} にいます`,
    sync,
    ...(staged.length > 0 ? [`ステージング済み（次のコミットに入る）: ${staged.join('、')}`] : []),
    ...(editing.length > 0 ? [`編集中（まだステージングしていない）: ${editing.join('、')}`] : []),
    ...(staged.length === 0 && editing.length === 0 ? ['コミットしていない変更はありません。'] : []),
  ]
}
