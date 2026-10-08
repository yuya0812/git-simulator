import { useState } from 'react'
import {
  BRANCH_NAME_EXAMPLE,
  changedFiles,
  commit,
  createBranch,
  createPullRequest,
  defaultCommitMessage,
  headFiles,
  MAIN,
  mergeLocal,
  switchBranch,
  type ConfirmOption,
  type OpResult,
  type State,
} from '../../engine'
import { describeWarning } from '../../hints'
import { useSimulator, type Dialog } from '../../store/useSimulator'
import { Button, Modal } from '../ui'

type Operation = (state: State, options: ConfirmOption) => OpResult

/** ダイアログを閉じてから実行し、実行しなかったときは同じダイアログを開き直す */
function useSubmit(dialog: Dialog) {
  const run = useSimulator((s) => s.run)
  const closeDialog = useSimulator((s) => s.closeDialog)
  return (operation: Operation) => {
    closeDialog()
    const result = run(operation)
    // 説明を残したまま開き直す（openDialog は説明を消すので使わない）
    if (result.kind === 'rejected') useSimulator.setState({ dialog })
  }
}

export function Dialogs() {
  const dialog = useSimulator((s) => s.dialog)
  const pending = useSimulator((s) => s.pending)
  if (pending) return <ConfirmDialog />
  if (!dialog) return null
  switch (dialog.type) {
    case 'createBranch':
      return <CreateBranchDialog />
    case 'switchAfterCreate':
      return <SwitchAfterCreateDialog branch={dialog.branch} />
    case 'switchBranch':
      return <SwitchBranchDialog />
    case 'commit':
      return <CommitDialog />
    case 'merge':
      return <MergeDialog />
    case 'createPullRequest':
      return <CreatePullRequestDialog />
  }
}

function InlineExplanation() {
  const explanation = useSimulator((s) => s.explanation)
  if (!explanation) return null
  return (
    <div className="rounded-xl bg-amber-50 p-3 text-amber-900">
      <p className="font-bold">{explanation.title}</p>
      {explanation.body.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  )
}

function suggestBranchName(state: State): string {
  const branches = state.local?.branches ?? {}
  if (!branches[BRANCH_NAME_EXAMPLE]) return BRANCH_NAME_EXAMPLE
  let n = 2
  while (branches[`${BRANCH_NAME_EXAMPLE}-${n}`]) n += 1
  return `${BRANCH_NAME_EXAMPLE}-${n}`
}

function CreateBranchDialog() {
  const sim = useSimulator((s) => s.sim)
  const closeDialog = useSimulator((s) => s.closeDialog)
  const submit = useSubmit({ type: 'createBranch' })
  const [name, setName] = useState(() => suggestBranchName(sim))
  const current = sim.local?.current ?? MAIN

  return (
    <Modal
      title="ブランチを作る"
      onClose={closeDialog}
      footer={
        <>
          <Button onClick={closeDialog}>やめる</Button>
          <Button variant="primary" onClick={() => submit((state) => createBranch(state, name.trim()))}>
            作る
          </Button>
        </>
      }
    >
      <p>
        今いる <b>{current}</b> と同じコミットに、新しい名札（ブランチ）を付けます。ファイルのコピーは作られません。
      </p>
      <label className="block">
        <span className="text-xs font-bold text-stone-500">ブランチ名</span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 font-mono outline-none focus:border-local-500"
        />
      </label>
      <InlineExplanation />
    </Modal>
  )
}

function SwitchAfterCreateDialog({ branch }: { branch: string }) {
  const current = useSimulator((s) => s.sim.local?.current)
  const closeDialog = useSimulator((s) => s.closeDialog)
  const submit = useSubmit({ type: 'switchAfterCreate', branch })
  return (
    <Modal
      title={`「${branch}」を作りました`}
      onClose={closeDialog}
      footer={
        <>
          <Button onClick={closeDialog}>今は移動しない</Button>
          <Button variant="primary" onClick={() => submit((state) => switchBranch(state, branch))}>
            移動する
          </Button>
        </>
      }
    >
      <p>
        今はまだ <b>{current}</b> にいます。<b>{branch}</b> に移動しますか？
      </p>
      <p className="text-stone-500">作ったブランチで作業するには、そのブランチに移動する必要があります。</p>
    </Modal>
  )
}

function SwitchBranchDialog() {
  const local = useSimulator((s) => s.sim.local)
  const closeDialog = useSimulator((s) => s.closeDialog)
  const submit = useSubmit({ type: 'switchBranch' })
  const branches = Object.keys(local?.branches ?? {})
  return (
    <Modal title="ブランチを移動" onClose={closeDialog} footer={<Button onClick={closeDialog}>閉じる</Button>}>
      <p>移動すると、ファイルの中身もそのブランチが指すコミットの状態になります。</p>
      <div className="flex flex-wrap gap-2">
        {branches.map((name) => (
          <Button
            key={name}
            variant={name === local?.current ? 'secondary' : 'local'}
            disabled={name === local?.current}
            onClick={() => submit((state) => switchBranch(state, name))}
          >
            {name === local?.current ? `${name}（今ここ）` : name}
          </Button>
        ))}
      </div>
      <InlineExplanation />
    </Modal>
  )
}

function CommitDialog() {
  const sim = useSimulator((s) => s.sim)
  const closeDialog = useSimulator((s) => s.closeDialog)
  const submit = useSubmit({ type: 'commit' })
  const [message, setMessage] = useState(() => defaultCommitMessage(sim))
  const local = sim.local
  const staged = local ? changedFiles(headFiles(sim, local), local.index) : []

  return (
    <Modal
      title="コミット"
      onClose={closeDialog}
      footer={
        <>
          <Button onClick={closeDialog}>やめる</Button>
          <Button variant="local" onClick={() => submit((state, options) => commit(state, { ...options, message }))}>
            コミットする
          </Button>
        </>
      }
    >
      <p>
        ステージングにある「プロジェクト全体の状態」を、<b>{local?.current}</b> の新しいコミットとして記録します。
      </p>
      <p className="text-stone-500">
        ステージング済み: {staged.length > 0 ? staged.join('、') : 'なし'}
      </p>
      <label className="block">
        <span className="text-xs font-bold text-stone-500">メッセージ（何をしたか後で分かるように）</span>
        <input
          autoFocus
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 outline-none focus:border-local-500"
        />
      </label>
      <InlineExplanation />
    </Modal>
  )
}

function MergeDialog() {
  const local = useSimulator((s) => s.sim.local)
  const closeDialog = useSimulator((s) => s.closeDialog)
  const submit = useSubmit({ type: 'merge' })
  const others = Object.keys(local?.branches ?? {}).filter((name) => name !== local?.current)
  return (
    <Modal title="merge（自分のPCで取り込む）" onClose={closeDialog} footer={<Button onClick={closeDialog}>閉じる</Button>}>
      <p>
        どのブランチを、今いる <b>{local?.current}</b> に取り込みますか？
      </p>
      <div className="flex flex-wrap gap-2">
        {others.length === 0 && <p className="text-stone-500">ほかのブランチがありません。</p>}
        {others.map((name) => (
          <Button key={name} variant="local" onClick={() => submit((state, options) => mergeLocal(state, name, options))}>
            {name}
          </Button>
        ))}
      </div>
      <InlineExplanation />
    </Modal>
  )
}

function CreatePullRequestDialog() {
  const sim = useSimulator((s) => s.sim)
  const closeDialog = useSimulator((s) => s.closeDialog)
  const submit = useSubmit({ type: 'createPullRequest' })
  const localOnly = Object.keys(sim.local?.branches ?? {}).filter(
    (name) => name !== MAIN && !sim.remote.branches[name],
  )
  const remote = Object.keys(sim.remote.branches).filter((name) => name !== MAIN)

  return (
    <Modal title="PR を作る（GitHub）" onClose={closeDialog} footer={<Button onClick={closeDialog}>閉じる</Button>}>
      <p>どのブランチの変更を、GitHub の main に取り込んでもらう依頼をしますか？</p>
      <div className="flex flex-wrap gap-2">
        {remote.map((name) => (
          <Button key={name} variant="remote" onClick={() => submit((state) => createPullRequest(state, name))}>
            {name}
          </Button>
        ))}
        {localOnly.map((name) => (
          <Button key={name} variant="secondary" onClick={() => submit((state) => createPullRequest(state, name))}>
            {name}（まだ GitHub にない）
          </Button>
        ))}
        {remote.length + localOnly.length === 0 && <p className="text-stone-500">作業用のブランチがありません。</p>}
      </div>
      <InlineExplanation />
    </Modal>
  )
}

function ConfirmDialog() {
  const pending = useSimulator((s) => s.pending)!
  const confirm = useSimulator((s) => s.confirmPending)
  const cancel = useSimulator((s) => s.cancelPending)
  const message = describeWarning(pending.warning)
  return (
    <Modal
      title={`ちょっと待って: ${message.title}`}
      onClose={cancel}
      footer={
        <>
          <Button onClick={cancel}>{message.cancelLabel}</Button>
          <Button variant="primary" onClick={confirm}>
            {message.confirmLabel}
          </Button>
        </>
      }
    >
      {message.body.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </Modal>
  )
}
