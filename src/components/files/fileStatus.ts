import { headFiles, type FileName, type State } from '../../engine'

export type FileStatus = { edited: boolean; staged: boolean }

export function fileStatus(state: State, file: FileName): FileStatus {
  const local = state.local
  if (!local) return { edited: false, staged: false }
  return {
    edited: local.workingTree[file] !== local.index[file],
    staged: local.index[file] !== headFiles(state, local)[file],
  }
}
