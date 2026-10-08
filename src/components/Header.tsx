import { useSimulator } from '../store/useSimulator'
import { Button } from './ui'

const STEPS = [
  { phase: 'beforeClone', label: 'clone する' },
  { phase: 'beforeBranch', label: 'ブランチを作る' },
  { phase: 'free', label: '自由に操作' },
] as const

export function Header() {
  const phase = useSimulator((s) => s.sim.phase)
  const reset = useSimulator((s) => s.reset)
  const currentIndex = STEPS.findIndex((step) => step.phase === phase)

  return (
    <header className="flex items-center gap-6">
      <div>
        <h1 className="text-xl font-bold">Git Simulator</h1>
        <p className="text-xs text-stone-500">コマンドを覚える前に、Git の世界を動かしてみよう</p>
      </div>
      <ol className="flex items-center gap-2 text-xs">
        {STEPS.map((step, index) => (
          <li
            key={step.phase}
            className={`rounded-full px-3 py-1 ${
              index === currentIndex
                ? 'bg-orange-400 font-bold text-white'
                : index < currentIndex
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-stone-100 text-stone-400'
            }`}
          >
            {index + 1}. {step.label}
          </li>
        ))}
      </ol>
      <Button variant="ghost" className="ml-auto" onClick={reset}>
        最初からやり直す
      </Button>
    </header>
  )
}
