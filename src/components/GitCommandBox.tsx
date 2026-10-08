import type { GitCommand } from '../hints'

/** 本物の Git ではどう打つのかを、ターミナル風に見せる */
export function GitCommandBox({ command, note, label = '本物の Git だと' }: GitCommand & { label?: string }) {
  if (!command && !note) return null
  return (
    <div className="rounded-xl bg-stone-800 px-3 py-2 text-xs leading-relaxed text-stone-200">
      <p className="mb-1 font-bold text-stone-400">{label}</p>
      {command && (
        <p className="font-mono text-sm text-emerald-300">
          <span className="mr-2 select-none text-stone-500">$</span>
          {command}
        </p>
      )}
      {note && <p className="mt-1 text-stone-300">{note}</p>}
    </div>
  )
}
