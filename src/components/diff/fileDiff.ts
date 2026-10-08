import { structuredPatch } from 'diff'
import { FILE_NAMES, type FileName, type Files } from '../../engine'

export type DiffLine = { kind: 'add' | 'remove' | 'context'; text: string }
export type FileDiff = { file: FileName; hunks: DiffLine[][] }

/** 2つの状態を比べ、変わったファイルごとに変更箇所（前後2行つき）を返す */
export function diffFiles(before: Files, after: Files): FileDiff[] {
  return FILE_NAMES.filter((file) => before[file] !== after[file]).map((file) => {
    const patch = structuredPatch(file, file, before[file], after[file], '', '', { context: 2 })
    return {
      file,
      hunks: patch.hunks.map((hunk) =>
        hunk.lines
          .filter((line) => !line.startsWith('\\')) // 「\ No newline at end of file」は表示しない
          .map((line): DiffLine => ({
            kind: line[0] === '+' ? 'add' : line[0] === '-' ? 'remove' : 'context',
            text: line.slice(1),
          })),
      ),
    }
  })
}
