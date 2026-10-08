import { editFile, FILE_NAMES, restoreFile } from '../../engine'
import { useSimulator } from '../../store/useSimulator'
import { Button, Panel, Tag } from '../ui'
import { fileStatus } from './fileStatus'

export function FilePanel() {
  const sim = useSimulator((s) => s.sim)
  const selected = useSimulator((s) => s.selectedFile)
  const selectFile = useSimulator((s) => s.selectFile)
  const run = useSimulator((s) => s.run)
  const local = sim.local

  if (!local) {
    return (
      <Panel title="ファイル" badge={<Tag tone="local">自分のPC</Tag>} className="h-full">
        <p className="p-2 text-sm leading-relaxed text-stone-500">
          まだ自分のPCには何もありません。
          <br />
          clone すると、GitHub にあるプロジェクトがここにコピーされます。
        </p>
      </Panel>
    )
  }

  const editable = sim.phase === 'free'
  const status = fileStatus(sim, selected)

  return (
    <Panel
      title="ファイル"
      badge={<Tag tone="local">自分のPC / {local.current}</Tag>}
      className="h-full"
    >
      <ul className="mb-3 space-y-1">
        {FILE_NAMES.map((file) => {
          const { edited, staged } = fileStatus(sim, file)
          return (
            <li key={file}>
              <button
                type="button"
                onClick={() => selectFile(file)}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left text-sm ${
                  file === selected ? 'bg-local-50 font-bold text-local-700' : 'hover:bg-stone-50'
                }`}
              >
                <span className="font-mono">{file}</span>
                <span className="ml-auto flex gap-1">
                  {edited && <Tag tone="orange">編集中</Tag>}
                  {staged && <Tag tone="local">ステージ済み</Tag>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="flex items-center gap-2 pb-2">
        <span className="font-mono text-xs text-stone-500">{selected}</span>
        <Button
          variant="ghost"
          className="ml-auto !px-3 !py-1 text-xs"
          disabled={!editable || (!status.edited && !status.staged)}
          onClick={() => run((state) => restoreFile(state, selected))}
          title="最後にコミットした内容に戻します"
        >
          最初に戻る
        </Button>
      </div>
      <textarea
        aria-label={`${selected} の中身`}
        spellCheck={false}
        readOnly={!editable}
        value={local.workingTree[selected]}
        onChange={(e) => run((state) => editFile(state, selected, e.target.value))}
        className="h-[calc(100%-9.5rem)] min-h-48 w-full resize-none rounded-xl border border-stone-200 bg-stone-50 p-4 font-mono text-sm leading-relaxed outline-none focus:border-local-500 read-only:opacity-70"
      />
      {!editable && <p className="pt-2 text-xs text-stone-500">ブランチを作ると編集できるようになります。</p>}
    </Panel>
  )
}
