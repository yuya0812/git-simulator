import { headFiles } from '../../engine'
import { git } from '../../hints'
import { useSimulator } from '../../store/useSimulator'
import { GitCommandBox } from '../GitCommandBox'
import { Button, Modal } from '../ui'
import { DiffView } from './DiffView'

/** 編集中の内容と、最後のコミットを比べる */
export function WorkingDiffDialog() {
  const sim = useSimulator((s) => s.sim)
  const close = useSimulator((s) => s.closeDialog)
  const local = sim.local
  if (!local) return null
  const head = local.branches[local.current]

  return (
    <Modal title="変更を見る（Diff）" wide onClose={close} footer={<Button onClick={close}>閉じる</Button>}>
      <p>
        最後のコミット（コミット {head}）と、今編集中の内容を比べた結果です。
        <span className="text-emerald-700">+ は追加した行</span>、<span className="text-rose-700">- は消した行</span>です。
      </p>
      <DiffView before={headFiles(sim, local)} after={local.workingTree} />
      <GitCommandBox command={git.diffHead()} note="ステージングに置いたものも含めて、最後のコミットからの変更を表示します" />
    </Modal>
  )
}

/** 2つのコミットを比べる。差分は保存されているものではなく、比べて作るものだと伝える */
export function CommitDiffDialog({ from, to }: { from: string; to: string }) {
  const sim = useSimulator((s) => s.sim)
  const close = useSimulator((s) => s.closeDialog)

  return (
    <Modal
      title={`コミット ${from} と コミット ${to} を比べる（Diff）`}
      wide
      onClose={close}
      footer={<Button onClick={close}>閉じる</Button>}
    >
      <p>
        コミット {from} の状態から、コミット {to} の状態で何が変わったかを表示しています。
        <span className="text-emerald-700">+ は追加された行</span>、<span className="text-rose-700">- は消された行</span>です。
      </p>
      <p className="rounded-xl bg-orange-50 px-3 py-2">
        Git が記録しているのは、それぞれのコミットの「全体の状態」です。この差分は、2つの状態を今その場で比べて作ったものです。
      </p>
      <DiffView before={sim.commits[from].files} after={sim.commits[to].files} />
      <GitCommandBox
        command={git.diffCommits(from, to)}
        note={`本物の Git では、${from} や ${to} の代わりにコミットのハッシュ（例: 3f2a1c9）を使います`}
      />
    </Modal>
  )
}
