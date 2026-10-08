import { deleteRemoteBranch, mergePullRequest, MAIN } from '../../engine'
import { useSimulator } from '../../store/useSimulator'
import { Button, Panel, Tag } from '../ui'
import { CommitGraph } from './CommitGraph'

function Legend({ side }: { side: 'local' | 'remote' }) {
  const tone = side === 'local' ? 'bg-local-500' : 'bg-remote-500'
  const ring = side === 'local' ? 'border-local-500 bg-local-100' : 'border-remote-500 bg-remote-100'
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-stone-500">
      <span className="flex items-center gap-1">
        <span className={`inline-block h-3 w-3 rounded-full ${tone}`} />
        自分のコミット
      </span>
      <span className="flex items-center gap-1">
        <span className={`inline-block h-3 w-3 rounded-full border-2 ${ring}`} />
        チームメイトのコミット
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-full border-2 border-dashed border-stone-300" />
        こちらにはまだ無いコミット
      </span>
      <span>コミットをクリックすると、中身を確認できます</span>
    </p>
  )
}

export function LocalPanel() {
  const sim = useSimulator((s) => s.sim)
  const local = sim.local
  return (
    <Panel title="LOCAL" badge={<Tag tone="local">自分のPC</Tag>} className="h-full border-local-100">
      {local ? (
        <>
          <CommitGraph side="local" />
          <Legend side="local" />
        </>
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
      <CommitGraph side="remote" />
      <Legend side="remote" />

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
