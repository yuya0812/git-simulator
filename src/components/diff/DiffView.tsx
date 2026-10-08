import { FILE_NAMES, type Files } from '../../engine'
import { diffFiles } from './fileDiff'

const LINE_STYLE = {
  add: 'bg-emerald-50 text-emerald-900',
  remove: 'bg-rose-50 text-rose-900',
  context: 'text-stone-500',
}
const MARK = { add: '+', remove: '-', context: ' ' }

/** 2つの状態を比べた結果。変わっていないファイルも「変更なし」として並べる */
export function DiffView({ before, after }: { before: Files; after: Files }) {
  const diffs = diffFiles(before, after)
  const changed = new Set(diffs.map((d) => d.file))

  return (
    <div className="space-y-3">
      {diffs.length === 0 && <p className="rounded-xl bg-stone-50 p-3 text-stone-500">違いはありません。2つはまったく同じ状態です。</p>}
      {diffs.map(({ file, hunks }) => (
        <section key={file} className="overflow-hidden rounded-xl border border-stone-200">
          <h3 className="bg-stone-100 px-3 py-1.5 font-mono text-xs font-bold">{file}</h3>
          {hunks.map((lines, index) => (
            <pre key={index} className="overflow-x-auto border-t border-stone-100 py-1 font-mono text-xs leading-relaxed">
              {lines.map((line, i) => (
                <div key={i} className={`px-3 ${LINE_STYLE[line.kind]}`}>
                  <span className="mr-3 inline-block w-3 select-none">{MARK[line.kind]}</span>
                  {line.text}
                </div>
              ))}
            </pre>
          ))}
        </section>
      ))}
      <p className="text-xs text-stone-500">
        変更なし: {FILE_NAMES.filter((f) => !changed.has(f)).join('、') || 'なし'}
      </p>
    </div>
  )
}
