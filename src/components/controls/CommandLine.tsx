import { useState, type KeyboardEvent } from 'react'
import { useSimulator } from '../../store/useSimulator'

const TONE = { ok: 'text-emerald-300', info: 'text-stone-200', error: 'text-amber-300' }

/** git コマンドを打って操作する欄。ボタンと同じ操作になる */
export function CommandLine() {
  const log = useSimulator((s) => s.commandLog)
  const runCommand = useSimulator((s) => s.runCommand)
  const [input, setInput] = useState('')
  /** ↑↓ で過去の入力を呼び出す位置（null は新しい入力） */
  const [cursor, setCursor] = useState<number | null>(null)
  const last = log[log.length - 1]

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter') {
      runCommand(input)
      setInput('')
      setCursor(null)
    } else if (e.key === 'ArrowUp' && log.length > 0) {
      e.preventDefault()
      const next = cursor === null ? log.length - 1 : Math.max(0, cursor - 1)
      setCursor(next)
      setInput(log[next].input)
    } else if (e.key === 'ArrowDown' && cursor !== null) {
      e.preventDefault()
      const next = cursor + 1
      if (next >= log.length) {
        setCursor(null)
        setInput('')
      } else {
        setCursor(next)
        setInput(log[next].input)
      }
    }
  }

  return (
    <div className="rounded-2xl bg-stone-800 px-4 py-2 font-mono text-sm text-stone-100">
      {last && (
        <div className="mb-1 max-h-24 overflow-y-auto border-b border-stone-700 pb-1 text-xs leading-relaxed">
          <p className="text-stone-400">$ {last.input}</p>
          {last.lines.map((line, i) => (
            <p key={i} className={`whitespace-pre-wrap ${TONE[last.tone]}`}>
              {line}
            </p>
          ))}
        </div>
      )}
      <label className="flex items-center gap-2">
        <span className="select-none text-stone-500">$</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
          aria-label="git コマンドを入力"
          placeholder="git status などを入力して Enter（help で使えるコマンドの一覧）"
          className="w-full bg-transparent text-emerald-200 outline-none placeholder:text-stone-500"
        />
      </label>
    </div>
  )
}
