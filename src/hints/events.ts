import { MAIN, type SimEvent, type State } from '../engine'
import { commitLabel, commitList, files, GITHUB, PC } from './text'
import type { Happened } from './types'

/** 操作が成功したときの「今起きたこと」。state は操作後の状態 */
export function describeEvent(event: SimEvent, state: State): Happened {
  switch (event.type) {
    case 'cloned':
      return {
        did: `${GITHUB} にあるプロジェクトを、履歴ごと${PC}にコピーしました（clone）`,
        changed: [`${PC}に、main ブランチと ${commitList(event.commitIds)} ができた`, `${PC}に index.html / style.css / script.js の全体がそろった`],
        unchanged: [`${GITHUB} のプロジェクト（コピーしただけで、元はそのまま）`],
        note: `ここから先、${PC}と ${GITHUB} は別々の場所です。片方を変えても、もう片方は自動では変わりません。`,
      }

    case 'branchCreated': {
      const current = state.local!.current
      return {
        did: `${commitLabel(event.at)} に「${event.name}」という名札（ブランチ）を付けました`,
        changed: [`名札が1枚増えた（${event.name} → ${commitLabel(event.at)}）`],
        unchanged: [
          'ファイルの中身（新しいコピーは作られていません）',
          event.switched ? `${commitLabel(event.at)} という場所` : `今いるブランチ（${current} のまま）`,
        ],
        note: event.switched
          ? undefined
          : `今は ${current} と ${event.name} の名札が、同じ ${commitLabel(event.at)} に付いています。作業を始めるには ${event.name} に移動しましょう。`,
      }
    }

    case 'switched':
      if (event.changedFiles.length === 0) {
        return {
          did: `${event.from} から ${event.to} に移動しました`,
          changed: [`今いるブランチ（${event.from} → ${event.to}）`],
          unchanged: [`ファイルの中身（どちらも同じ ${commitLabel(event.at)} を指しているため）`, 'コミットや履歴'],
          note: '名札を移っただけで、ファイルは何も変わっていません。ブランチはフォルダではなく、コミットに付いた名札だからです。',
        }
      }
      return {
        did: `${event.from} から ${event.to} に移動しました`,
        changed: [
          `今いるブランチ（${event.from} → ${event.to}）`,
          `${files(event.changedFiles)} の中身が、${event.to} が指す ${commitLabel(event.at)} の状態に入れ替わった`,
        ],
        unchanged: ['コミットや履歴（どのブランチのコミットも消えていません）'],
        note: `${event.from} に戻れば、${commitLabel(event.fromCommit)} の状態に戻ります。`,
      }

    case 'edited':
      return {
        did: `${event.file} を編集しています`,
        changed: [`編集中の ${event.file}`],
        unchanged: ['ステージングとコミット（まだどこにも記録されていません）'],
      }

    case 'restored':
      return {
        did: `${event.file} を、最後にコミットした内容に戻しました`,
        changed: [`編集中・ステージングの ${event.file}`],
        unchanged: ['コミットや履歴', 'ほかのファイル'],
      }

    case 'staged':
      return {
        did: `${event.file} をステージングに置きました`,
        changed: ['ステージング（次のコミットに入る内容）'],
        unchanged: ['コミットや履歴（まだ記録されていません）'],
        note: 'コミットすると、ステージングにある「プロジェクト全体の状態」がそのまま記録されます。',
      }

    case 'committed': {
      const commit = state.commits[event.id]
      return {
        did: `${commitLabel(event.id)} を作りました`,
        changed: [
          `${event.branch} の名札が ${commitLabel(commit.parents[0])} から ${commitLabel(event.id)} に移動した`,
          `${commitLabel(event.id)} に、${files(event.changedFiles)} を変更した後のプロジェクト全体の状態が記録された`,
        ],
        unchanged: [
          ...otherBranches(state, event.branch).map((name) => `${name}（${commitLabel(state.local!.branches[name])} のまま）`),
          `${GITHUB}（まだ送っていません）`,
        ],
        note:
          event.leftUnstaged.length > 0
            ? `${files(event.leftUnstaged)} はステージングしていないので、${commitLabel(event.id)} には変更前の状態で記録されました。変更は編集中のまま残っています。`
            : `${commitLabel(event.id)} は「変更したところだけ」ではなく、3つのファイルすべてを含む完全な状態です。`,
      }
    }

    case 'merged':
      return {
        did: `${event.from} を ${event.into} に取り込みました（merge）`,
        changed: [`${event.into} の名札が、2つのラインを合わせた ${commitLabel(event.id)} に移動した`],
        unchanged: [`${event.from}（取り込まれた側はそのまま）`, `${GITHUB}（まだ送っていません）`],
      }

    case 'pushed':
      return {
        did: `${event.branch} を ${GITHUB} へ送りました（push）`,
        changed: [
          event.created
            ? `${GITHUB} に ${event.branch} ができた`
            : `${GITHUB} の ${event.branch} が ${commitLabel(state.remote.branches[event.branch])} を指すようになった`,
          ...(event.sentCommitIds.length > 0 ? [`${commitList(event.sentCommitIds)} が ${GITHUB} にも届いた`] : []),
        ],
        unchanged:
          event.branch === MAIN
            ? [`${PC}のファイル`]
            : [`${GITHUB} の main（公開中のサイトはまだ変わっていません）`, `${PC}のファイル`],
      }

    case 'pulled':
      if (event.mode === 'upToDate') {
        return {
          did: `${GITHUB} の ${event.branch} を確認しました（pull）`,
          changed: [],
          unchanged: [`${event.branch}（すでに最新でした）`],
        }
      }
      return {
        did: `${GITHUB} の ${event.branch} の変更を取り込みました（pull）`,
        changed: [
          ...(event.receivedCommitIds.length > 0 ? [`${commitList(event.receivedCommitIds)} が${PC}に届いた`] : []),
          event.mode === 'fastForward'
            ? `${event.branch} の名札が ${commitLabel(state.local!.branches[event.branch])} に移動した`
            : `両方の変更を合わせた ${commitLabel(event.id!)} ができ、${event.branch} の名札がそこに移動した`,
          'ファイルの中身が最新の状態になった',
        ],
        unchanged: [`${GITHUB}（取り込んだだけで、送ってはいません）`],
        note:
          event.mode === 'merge'
            ? `${PC}と ${GITHUB} の両方が進んでいたので、2つを合わせるコミットを作りました。${GITHUB} に反映するには push します。`
            : undefined,
      }

    case 'prCreated':
      return {
        did: `PR #${event.prId} を作りました`,
        changed: [`「${event.from} の変更を ${event.to} に取り込んでください」という依頼ができた`],
        unchanged: [`${GITHUB} の ${event.to}（依頼しただけで、まだ取り込まれていません）`],
        note: 'チームメイトがレビューして承認するのを待ちましょう。',
      }

    case 'prApproved':
      return {
        did: `チームメイトが PR #${event.prId} を承認しました`,
        changed: ['PR が merge できる状態になった'],
        unchanged: [`${GITHUB} の main（まだ取り込まれていません）`],
      }

    case 'prMerged':
      return {
        did: `PR #${event.prId} を merge しました`,
        changed: [`${GITHUB} の ${event.to} の名札が、2つのラインを合わせた ${commitLabel(event.id)} に移動した`, '公開中のサイトが新しい状態になった'],
        unchanged: [`${PC}の ${event.to}（まだ古いままです）`],
        note: `merge は ${GITHUB} の上で起きたので、${PC}の ${event.to} はまだ知りません。${event.to} に移動して pull すると最新になります。`,
      }

    case 'remoteBranchDeleted':
      return {
        did: `${GITHUB} の ${event.name} を削除しました`,
        changed: [`${GITHUB} から ${event.name} の名札が外れた`],
        unchanged: ['コミット（main に取り込まれているので消えていません）', `${PC}の ${event.name}`],
      }

    case 'teammateCommitted':
      return {
        did: `チームメイトが ${GITHUB} の main を更新しました`,
        changed: [`${GITHUB} の main が ${commitLabel(event.id)}（${event.file} を変更）に進んだ`],
        unchanged: [`${PC}の main（まだこの変更を知りません）`],
        note: `${PC}と ${GITHUB} がずれた状態です。${PC}に取り込むには、main で pull します。`,
      }
  }
}

function otherBranches(state: State, current: string): string[] {
  return Object.keys(state.local!.branches).filter((name) => name !== current)
}
