import { ancestors, deleteRemoteBranch, mergePullRequest, MAIN, type State } from '../../engine'
import { useSimulator } from '../../store/useSimulator'
import { Button, Panel, Tag } from '../ui'

/** branches の名札からたどれるコミット（新しい順） */
function reachableCommits(state: State, branches: Record<string, string>): string[] {
  const ids = new Set(Object.values(branches).flatMap((tip) => [...ancestors(state.commits, tip)]))
  return Object.keys(state.commits)
    .filter((id) => ids.has(id))
    .reverse()
}

function CommitList({
  state,
  branches,
  current,
  tone,
}: {
  state: State
  branches: Record<string, string>
  current?: string
  tone: 'local' | 'remote'
}) {
  const ids = reachableCommits(state, branches)
  return (
    <ul className="space-y-1">
      {ids.map((id) => {
        const commit = state.commits[id]
        const labels = Object.entries(branches).filter(([, tip]) => tip === id)
        return (
          <li key={id} className="flex flex-wrap items-center gap-2 rounded-xl px-2 py-1 text-sm hover:bg-stone-50">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${
                tone === 'local' ? 'bg-local-500' : 'bg-remote-500'
              }`}
            >
              {id}
            </span>
            <span className="text-xs text-stone-600">{commit.message}</span>
            {commit.author === 'teammate' && <Tag tone="stone">チームメイト</Tag>}
            {labels.map(([name]) => (
              <Tag key={name} tone={tone}>
                {name === current ? `[今ここ] ${name}` : name}
              </Tag>
            ))}
          </li>
        )
      })}
    </ul>
  )
}

export function LocalPanel() {
  const sim = useSimulator((s) => s.sim)
  const local = sim.local
  return (
    <Panel title="LOCAL" badge={<Tag tone="local">自分のPC</Tag>} className="h-full border-local-100">
      {local ? (
        <CommitList state={sim} branches={local.branches} current={local.current} tone="local" />
      ) : (
        <p className="text-sm text-stone-500">まだ何もありません。</p>
      )}
    </Panel>
  )
}

export function RemotePanel() {
  const sim = useSimulator((s) => s.sim)
  const run = useSimulator((s) => s.run)
  return (
    <Panel title="REMOTE" badge={<Tag tone="remote">GitHub</Tag>} className="h-full border-remote-100">
      <CommitList state={sim} branches={sim.remote.branches} tone="remote" />

      {sim.pullRequests.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
          <p className="text-xs font-bold text-stone-500">Pull Request</p>
          {sim.pullRequests.map((pr) => (
            <div key={pr.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-remote-50 px-3 py-2 text-sm">
              <span className="font-bold">#{pr.id}</span>
              <span className="text-xs">
                {pr.from} → {pr.to}
              </span>
              {pr.status === 'open' && <Tag tone="stone">レビュー中...</Tag>}
              {pr.status === 'approved' && <Tag tone="remote">承認済み</Tag>}
              {pr.status === 'merged' && <Tag tone="stone">merge 済み</Tag>}
              <span className="ml-auto flex gap-2">
                {pr.status !== 'merged' && (
                  <Button
                    variant="remote"
                    className="!px-3 !py-1 text-xs"
                    disabled={pr.status !== 'approved'}
                    onClick={() => run((state) => mergePullRequest(state, pr.id))}
                  >
                    PR を merge
                  </Button>
                )}
                {pr.status === 'merged' && pr.from !== MAIN && sim.remote.branches[pr.from] && (
                  <Button
                    variant="secondary"
                    className="!px-3 !py-1 text-xs"
                    onClick={() => run((state) => deleteRemoteBranch(state, pr.from))}
                  >
                    ブランチを削除
                  </Button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
