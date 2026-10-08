import { MAIN, type Files } from '../../engine'
import { useSimulator, type PreviewMode } from '../../store/useSimulator'
import { Panel, Tag } from '../ui'
import { buildPreviewDocument } from './previewDocument'

const TABS: { mode: PreviewMode; label: string }[] = [
  { mode: 'working', label: '手元（編集中）' },
  { mode: 'githubMain', label: 'GitHub の main' },
  { mode: 'commit', label: '選んだコミット' },
]

type Shown = { files: Files; caption: string; tone: 'local' | 'remote' | 'orange' } | { empty: string }

/** 仮想プロジェクトを iframe で表示する。どのコミットも、それだけで動く完全な状態であることを見せる */
export function PreviewPanel() {
  const sim = useSimulator((s) => s.sim)
  const mode = useSimulator((s) => s.previewMode)
  const setMode = useSimulator((s) => s.setPreviewMode)
  const selected = useSimulator((s) => s.selectedCommits)
  const commitId = selected[selected.length - 1]

  const shown: Shown = (() => {
    switch (mode) {
      case 'working':
        return sim.local
          ? { files: sim.local.workingTree, caption: `自分のPCの ${sim.local.current}（編集中の内容）`, tone: 'local' }
          : { empty: 'まだ自分のPCには何もありません。clone すると表示されます。' }
      case 'githubMain': {
        const id = sim.remote.branches[MAIN]
        return { files: sim.commits[id].files, caption: `GitHub の main（コミット ${id}）= 公開中のサイト`, tone: 'remote' }
      }
      case 'commit':
        return commitId
          ? { files: sim.commits[commitId].files, caption: `コミット ${commitId} に記録されている状態`, tone: 'orange' }
          : { empty: 'グラフのコミットをクリックすると、そのコミットの状態をここで動かせます。' }
    }
  })()

  return (
    <Panel
      title="プレビュー"
      className="h-full"
      actions={
        <div role="tablist" className="flex gap-1 rounded-full bg-stone-100 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.mode}
              type="button"
              role="tab"
              aria-selected={mode === tab.mode}
              onClick={() => setMode(tab.mode)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                mode === tab.mode ? 'bg-white text-ink shadow-sm' : 'text-stone-500 hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      }
    >
      {'empty' in shown ? (
        <p className="p-2 text-sm text-stone-500">{shown.empty}</p>
      ) : (
        <div className="flex h-full flex-col gap-2">
          <div className="flex items-center gap-2">
            <Tag tone={shown.tone}>表示中</Tag>
            <span className="text-xs text-stone-600">{shown.caption}</span>
          </div>
          <iframe
            title="プレビュー"
            // ユーザーが書いたスクリプトも動かすが、親ページには触れさせない
            sandbox="allow-scripts"
            srcDoc={buildPreviewDocument(shown.files)}
            className="min-h-0 w-full flex-1 rounded-xl border border-stone-200 bg-white"
          />
        </div>
      )}
    </Panel>
  )
}
