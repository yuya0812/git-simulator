import { suggestNext } from '../../hints'
import { useSimulator } from '../../store/useSimulator'
import { Button } from '../ui'

/** 「今起きたこと」と「次にできること」。実行しなかった操作の説明もここに出す */
export function HintPanel() {
  const sim = useSimulator((s) => s.sim)
  const happened = useSimulator((s) => s.happened)
  const explanation = useSimulator((s) => s.explanation)
  const dismiss = useSimulator((s) => s.dismissExplanation)
  const next = suggestNext(sim)

  return (
    <section className="grid grid-cols-[3fr_2fr] gap-3">
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        {explanation ? (
          <div className="rounded-xl bg-amber-50 p-3" role="status">
            <div className="flex items-start gap-2">
              <h3 className="font-bold text-amber-800">ちょっと待って: {explanation.title}</h3>
              <Button variant="ghost" className="ml-auto !px-2 !py-0.5 text-xs" onClick={dismiss}>
                閉じる
              </Button>
            </div>
            <div className="mt-1 space-y-1 text-sm leading-relaxed">
              {explanation.body.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
        ) : happened ? (
          <div className="text-sm leading-relaxed" role="status">
            <h3 className="mb-2 font-bold">今起きたこと</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="font-bold text-stone-500">何をした？</dt>
              <dd>{happened.did}</dd>
              <dt className="font-bold text-stone-500">何が変わった？</dt>
              <dd>
                <Lines lines={happened.changed} empty="なし" />
              </dd>
              <dt className="font-bold text-stone-500">何は変わっていない？</dt>
              <dd>
                <Lines lines={happened.unchanged} empty="-" />
              </dd>
            </dl>
            {happened.note && <p className="mt-2 rounded-xl bg-orange-50 px-3 py-2">{happened.note}</p>}
          </div>
        ) : (
          <div className="text-sm leading-relaxed">
            <h3 className="mb-2 font-bold">ようこそ</h3>
            <p>このアプリでは、Git の中で何が起きているのかを、実際に操作しながら確かめられます。</p>
            <p>操作するたびに、ここに「何をした」「何が変わった」「何は変わっていない」が表示されます。</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-bold">次にできること</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
          {next.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Lines({ lines, empty }: { lines: string[]; empty: string }) {
  if (lines.length === 0) return <span className="text-stone-400">{empty}</span>
  return (
    <ul className="space-y-0.5">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  )
}
