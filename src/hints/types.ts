/** ヒント欄の「今起きたこと」 */
export type Happened = {
  /** 何をした？ */
  did: string
  /** 何が変わった？ */
  changed: string[]
  /** 何は変わっていない？ */
  unchanged: string[]
  /** 補足（気づいてほしいポイント） */
  note?: string
}

/** 実行しなかった操作の説明 */
export type Explanation = {
  title: string
  body: string[]
}

/** 実行前に確認を取る操作の説明 */
export type ConfirmMessage = Explanation & {
  confirmLabel: string
  cancelLabel: string
}
