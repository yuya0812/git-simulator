import { changedFiles, FILE_NAMES } from '../../engine'
import { useSimulator } from '../../store/useSimulator'
import { Button, Tag } from '../ui'

/** グラフで選んだコミットの中身。コミットが「全体の状態」であることを確かめる場所 */
export function CommitDetail() {
  const sim = useSimulator((s) => s.sim)
  const selected = useSimulator((s) => s.selectedCommits)
  const clear = useSimulator((s) => s.clearSelectedCommits)

  if (selected.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-stone-300 px-4 py-3 text-sm text-stone-500">
        グラフのコミットをクリックすると、そのコミットに記録されている中身をここで確認できます。2つ選ぶと比べられます。
      </p>
    )
  }

  return (
    <section className="rounded-2xl border border-orange-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-bold">選んだコミット</h2>
        {selected.length === 2 && <Tag tone="orange">2つ選択中（比べる機能は準備中）</Tag>}
        <Button variant="ghost" className="ml-auto !px-3 !py-1 text-xs" onClick={clear}>
          選択を外す
        </Button>
      </div>
      <div className={`grid gap-3 ${selected.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {selected.map((id) => {
          const commit = sim.commits[id]
          const parent = commit.parents[0] ? sim.commits[commit.parents[0]] : undefined
          const changed = new Set(parent ? changedFiles(parent.files, commit.files) : [])
          return (
            <div key={id} className="rounded-xl bg-stone-50 p-3 text-sm">
              <p className="font-bold">
                コミット {id}
                <span className="ml-2 font-normal text-stone-600">{commit.message}</span>
              </p>
              <p className="mt-1 text-xs text-stone-500">
                {commit.author === 'teammate' ? 'チームメイト' : 'あなた'}が作成
                {commit.parents.length > 0 && ` / 親: ${commit.parents.map((p) => `コミット ${p}`).join('、')}`}
                {commit.parents.length > 1 && '（2つのラインを合わせたマージコミット）'}
              </p>
              <p className="mt-2 text-xs font-bold text-stone-500">記録されているファイル（3つすべて）</p>
              <ul className="mt-1 space-y-1">
                {FILE_NAMES.map((file) => (
                  <li key={file} className="flex items-center gap-2">
                    <span className="font-mono text-xs">{file}</span>
                    {changed.has(file) && parent && <Tag tone="orange">コミット {parent.id} から変更</Tag>}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-stone-500">
                変更したファイルだけでなく、そのときのプロジェクト全体がまるごと記録されています。
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
