import { Panel } from '../ui'

/** Phase 6 で iframe のプレビューに置き換える */
export function PreviewPanel() {
  return (
    <Panel title="プレビュー" className="h-full">
      <p className="text-sm text-stone-500">ここにアプリのプレビューが表示されます（準備中）。</p>
    </Panel>
  )
}
