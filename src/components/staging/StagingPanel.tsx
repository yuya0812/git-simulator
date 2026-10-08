import { FILE_NAMES, stageFile } from '../../engine'
import { useSimulator } from '../../store/useSimulator'
import { fileStatus } from '../files/fileStatus'
import { Button, Panel, Tag } from '../ui'

/** 編集中 → ステージング → コミット の3つの場所を並べて見せる */
export function StagingPanel() {
  const sim = useSimulator((s) => s.sim)
  const run = useSimulator((s) => s.run)
  const openDialog = useSimulator((s) => s.openDialog)
  const local = sim.local
  const free = sim.phase === 'free'

  const statuses = FILE_NAMES.map((file) => ({ file, ...fileStatus(sim, file) }))
  const editing = statuses.filter((s) => s.edited)
  const staged = statuses.filter((s) => s.staged)

  return (
    <Panel
      title="ステージング"
      badge={<Tag tone="local">自分のPC</Tag>}
      className="h-full"
      actions={
        <Button
          variant="ghost"
          className="!px-3 !py-1 text-xs"
          disabled={!free || (editing.length === 0 && staged.length === 0)}
          onClick={() => openDialog({ type: 'diffWorking' })}
        >
          変更を見る（Diff）
        </Button>
      }
    >
      {!local ? (
        <p className="text-sm text-stone-500">clone すると使えるようになります。</p>
      ) : (
        <div className="grid h-full grid-cols-[1fr_auto_1fr_auto_auto] items-start gap-2 text-sm">
          <Column title="編集中">
            {editing.length === 0 && <Empty />}
            {editing.map(({ file }) => (
              <div key={file} className="flex items-center gap-2 rounded-xl bg-orange-50 px-2 py-1">
                <span className="font-mono text-xs">{file}</span>
                <Button
                  variant="secondary"
                  className="ml-auto !px-2 !py-0.5 text-xs"
                  disabled={!free}
                  onClick={() => run((state) => stageFile(state, file))}
                >
                  置く
                </Button>
              </div>
            ))}
          </Column>
          <Arrow />
          <Column title="ステージング（次のコミットに入る）">
            {staged.length === 0 && <Empty />}
            {staged.map(({ file }) => (
              <div key={file} className="rounded-xl bg-local-50 px-2 py-1 font-mono text-xs">
                {file}
              </div>
            ))}
          </Column>
          <Arrow />
          <div className="pt-6">
            <Button variant="local" disabled={!free} onClick={() => openDialog({ type: 'commit' })}>
              コミット
            </Button>
          </div>
        </div>
      )}
    </Panel>
  )
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold text-stone-500">{title}</p>
      {children}
    </div>
  )
}

function Arrow() {
  return <span className="pt-7 text-stone-300">→</span>
}

function Empty() {
  return <p className="text-xs text-stone-400">なし</p>
}
