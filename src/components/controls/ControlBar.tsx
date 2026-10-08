import { cloneRepo, pull, push, teammateUpdate } from '../../engine'
import { useSimulator } from '../../store/useSimulator'
import { Button } from '../ui'
import { CommandLine } from './CommandLine'

const PHASE_GUIDE = {
  beforeClone: 'まずは clone して、GitHub のプロジェクトを自分のPCにコピーしよう',
  beforeBranch: '次は main から作業用のブランチを作ろう',
  free: null,
} as const

export function ControlBar() {
  const phase = useSimulator((s) => s.sim.phase)
  const run = useSimulator((s) => s.run)
  const openDialog = useSimulator((s) => s.openDialog)
  const free = phase === 'free'

  return (
    <section className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 shadow-[0_-4px_16px_rgba(0,0,0,0.05)] backdrop-blur">
      <div className="mx-auto max-w-[1600px] px-6 py-3">
        <LatestResult />
        <div className="flex flex-wrap items-center gap-2">
          <Group label="自分のPC">
            <Button variant="primary" disabled={phase !== 'beforeClone'} onClick={() => run(cloneRepo)}>
              clone
            </Button>
            <Button
              variant={phase === 'beforeBranch' ? 'primary' : 'local'}
              disabled={phase === 'beforeClone'}
              onClick={() => openDialog({ type: 'createBranch' })}
            >
              ブランチを作る
            </Button>
            <Button variant="local" disabled={!free} onClick={() => openDialog({ type: 'switchBranch' })}>
              ブランチを移動
            </Button>
            <Button variant="local" disabled={!free} onClick={() => openDialog({ type: 'commit' })}>
              コミット
            </Button>
            <Button variant="local" disabled={!free} onClick={() => openDialog({ type: 'merge' })}>
              取り込む（merge）
            </Button>
          </Group>

          <Group label="自分のPC ⇄ GitHub">
            <Button variant="secondary" disabled={!free} onClick={() => run(push)}>
              push
            </Button>
            <Button variant="secondary" disabled={!free} onClick={() => run(pull)}>
              pull
            </Button>
          </Group>

          <Group label="GitHub">
            <Button variant="remote" disabled={!free} onClick={() => openDialog({ type: 'createPullRequest' })}>
              PR を作る
            </Button>
            <Button variant="secondary" disabled={!free} onClick={() => run(teammateUpdate)}>
              チームメイトが main を更新
            </Button>
          </Group>
        </div>
        {PHASE_GUIDE[phase] && <p className="mt-2 text-sm font-medium text-orange-600">{PHASE_GUIDE[phase]}</p>}
        <div className="mt-2">
          <CommandLine />
        </div>
      </div>
    </section>
  )
}

/** 直前の操作の結果を1行で出す。ヒント欄が画面の外にあっても結果を見逃さないため */
function LatestResult() {
  const happened = useSimulator((s) => s.happened)
  const explanation = useSimulator((s) => s.explanation)
  const command = useSimulator((s) => s.command)
  if (!happened && !explanation) return null
  return (
    <div className="mb-2 flex items-center gap-3 text-sm">
      {explanation ? (
        <span className="font-bold text-amber-700">ちょっと待って: {explanation.title}</span>
      ) : (
        <span>
          <span className="mr-2 text-xs font-bold text-stone-500">今起きたこと</span>
          {happened!.did}
          {command?.command && (
            <code className="ml-3 rounded-lg bg-stone-800 px-2 py-0.5 font-mono text-xs text-emerald-300">
              $ {command.command}
            </code>
          )}
        </span>
      )}
      <Button
        variant="ghost"
        className="!px-2 !py-0.5 text-xs underline"
        onClick={() => document.getElementById('hint')?.scrollIntoView({ behavior: 'smooth' })}
      >
        詳しく見る
      </Button>
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-stone-50 px-3 py-2">
      <span className="text-xs font-bold text-stone-500">{label}</span>
      {children}
    </div>
  )
}
