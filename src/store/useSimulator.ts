import { create } from 'zustand'
import {
  approvePullRequest,
  createInitialState,
  type ConfirmOption,
  type FileName,
  type OpResult,
  type SimEvent,
  type State,
  type Warning,
} from '../engine'
import { commandForEvent, describeEvent, describeRejection, type Explanation, type GitCommand, type Happened } from '../hints'

/** PR を作ってからチームメイトが承認するまでの時間 */
export const APPROVE_DELAY_MS = 3000

type Operation = (state: State, options: ConfirmOption) => OpResult

/** 開いているダイアログ */
export type Dialog =
  | { type: 'createBranch' }
  | { type: 'switchAfterCreate'; branch: string }
  | { type: 'switchBranch' }
  | { type: 'commit' }
  | { type: 'merge' }
  | { type: 'createPullRequest' }

type Store = {
  sim: State
  /** 直前に成功した操作 */
  lastEvent: SimEvent | null
  happened: Happened | null
  /** 直前の操作を、本物の Git で打つとどうなるか */
  command: GitCommand | null
  /** 実行しなかった操作の説明（次の操作まで表示） */
  explanation: Explanation | null
  /** 確認待ちの操作 */
  pending: { warning: Warning; operation: Operation } | null
  dialog: Dialog | null
  selectedFile: FileName

  run: (operation: Operation) => OpResult
  confirmPending: () => void
  cancelPending: () => void
  openDialog: (dialog: Dialog) => void
  closeDialog: () => void
  selectFile: (file: FileName) => void
  dismissExplanation: () => void
  reset: () => void
}

const initial = () => ({
  sim: createInitialState(),
  lastEvent: null,
  happened: null,
  command: null,
  explanation: null,
  pending: null,
  dialog: null,
  selectedFile: 'index.html' as FileName,
})

/** 「最初からやり直す」のたびに増やし、やり直す前に予約した処理を無効にする */
let generation = 0

export const useSimulator = create<Store>()((set, get) => {
  function apply(operation: Operation, options: ConfirmOption): OpResult {
    const result = operation(get().sim, options)
    switch (result.kind) {
      case 'ok':
        // 1文字打つごとに同じ説明を作り直さない
        if (result.event.type === 'edited' && isSameEdit(get().lastEvent, result.event)) {
          set({ sim: result.state })
        } else {
          set({
            sim: result.state,
            lastEvent: result.event,
            happened: describeEvent(result.event, result.state),
            command: commandForEvent(result.event, result.state),
            explanation: null,
            pending: null,
          })
        }
        afterEvent(result.event)
        break
      case 'rejected':
        set({ explanation: describeRejection(result.rejection), pending: null })
        break
      case 'needsConfirm':
        set({ pending: { warning: result.warning, operation } })
        break
    }
    return result
  }

  function afterEvent(event: SimEvent) {
    if (event.type === 'prCreated') {
      const scheduledIn = generation
      setTimeout(() => {
        // 待っている間に「最初からやり直す」された場合は何もしない
        if (scheduledIn !== generation) return
        const pr = get().sim.pullRequests.find((p) => p.id === event.prId)
        if (pr?.status === 'open') apply((state) => approvePullRequest(state, event.prId), {})
      }, APPROVE_DELAY_MS)
    }
    if (event.type === 'branchCreated' && !event.switched) {
      set({ dialog: { type: 'switchAfterCreate', branch: event.name } })
    }
  }

  return {
    ...initial(),
    run: (operation) => apply(operation, {}),
    confirmPending: () => {
      const pending = get().pending
      if (pending) apply(pending.operation, { confirmed: true })
    },
    cancelPending: () => set({ pending: null }),
    // 前の操作の説明が、新しく開いたダイアログに残らないようにする
    openDialog: (dialog) => set({ dialog, explanation: null }),
    closeDialog: () => set({ dialog: null }),
    selectFile: (file) => set({ selectedFile: file }),
    dismissExplanation: () => set({ explanation: null }),
    reset: () => {
      generation += 1
      set(initial())
    },
  }
})

function isSameEdit(previous: SimEvent | null, event: SimEvent): boolean {
  return previous?.type === 'edited' && event.type === 'edited' && previous.file === event.file
}
