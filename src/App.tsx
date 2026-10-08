import { Dialogs } from './components/controls/Dialogs'
import { ControlBar } from './components/controls/ControlBar'
import { CommitDetail } from './components/graph/CommitDetail'
import { FilePanel } from './components/files/FilePanel'
import { LocalPanel, RemotePanel } from './components/graph/RepoPanels'
import { Header } from './components/Header'
import { HintPanel } from './components/hint/HintPanel'
import { PreviewPanel } from './components/preview/PreviewPanel'
import { StagingPanel } from './components/staging/StagingPanel'

export default function App() {
  return (
    <>
      {/* PC のみ対応（要件 12.1） */}
      <div className="flex min-h-screen items-center justify-center p-8 text-center lg:hidden">
        <div className="space-y-2">
          <h1 className="text-xl font-bold">Git Simulator</h1>
          <p>このアプリは PC で開いてください。</p>
          <p className="text-sm text-stone-500">ファイル・グラフ・プレビューを並べて見るため、広い画面が必要です。</p>
        </div>
      </div>

      {/* 1画面に収めず縦に並べる。操作ボタンだけ画面下に固定する */}
      <div className="hidden lg:block">
        <div className="mx-auto max-w-[1600px] space-y-4 px-6 pt-5 pb-64">
          <Header />
          <div id="hint" className="scroll-mt-4">
            <HintPanel />
          </div>
          <div className="grid min-h-[300px] grid-cols-2 gap-4">
            <LocalPanel />
            <RemotePanel />
          </div>
          <CommitDetail />
          <StagingPanel />
          <main className="grid h-[72vh] min-h-[560px] grid-cols-2 gap-4">
            <FilePanel />
            <PreviewPanel />
          </main>
        </div>
        <ControlBar />
      </div>

      <Dialogs />
    </>
  )
}
