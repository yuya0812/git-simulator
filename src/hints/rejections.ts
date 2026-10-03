import { BRANCH_NAME_EXAMPLE, type Rejection, type Warning } from '../engine'
import { files, GITHUB, PC } from './text'
import type { ConfirmMessage, Explanation } from './types'

/** 実行しなかった操作の説明。エラーとして突き放さず、理由と次の一手を伝える */
export function describeRejection(rejection: Rejection): Explanation {
  switch (rejection.code) {
    case 'alreadyCloned':
      return { title: 'clone は済んでいます', body: [`プロジェクトはもう${PC}にコピーされています。`] }

    case 'notCloned':
      return {
        title: 'まずは clone しましょう',
        body: [`まだ${PC}にプロジェクトがありません。${GITHUB} にあるプロジェクトを clone して、手元にコピーするところから始めます。`],
      }

    case 'createBranchFirst':
      return {
        title: 'まずはブランチを作りましょう',
        body: ['作業を始める前に、main から自分用のブランチを作ります。', `名前の例: ${BRANCH_NAME_EXAMPLE}`],
      }

    case 'invalidBranchName':
      return {
        title: 'この名前は使えません',
        body: [
          `「${rejection.name}」はブランチ名に使えません。`,
          '半角の英数字と - _ . / が使えます。空白や日本語は使えません。',
          `例: ${BRANCH_NAME_EXAMPLE}`,
        ],
      }

    case 'branchExists':
      return { title: '同じ名前のブランチがあります', body: [`「${rejection.name}」はもうあります。別の名前を付けましょう。`] }

    case 'branchNotFound':
      return { title: 'ブランチが見つかりません', body: [`「${rejection.name}」というブランチは${PC}にありません。`] }

    case 'alreadyOnBranch':
      return { title: 'もうこのブランチにいます', body: [`今いるのが ${rejection.name} です。`] }

    case 'uncommittedChanges':
      return {
        title: 'まだコミットしていない変更があります',
        body: [
          `${files(rejection.files)} に、まだコミットしていない変更があります。`,
          'このまま進むと、変更がどこに属するのか分からなくなってしまいます。',
          'コミットするか、「最初に戻る」で変更を取り消してからもう一度試しましょう。',
        ],
      }

    case 'noChangeToStage':
      return { title: 'ステージングするものがありません', body: [`${rejection.file} は、ステージングにある内容から変わっていません。`] }

    case 'noChangeToRestore':
      return { title: '戻すものがありません', body: [`${rejection.file} は、最後にコミットした内容のままです。`] }

    case 'nothingStaged':
      return {
        title: 'ステージングに何もありません',
        body: ['コミットは、ステージングにある状態を記録します。', 'まず変更したファイルをステージングに置きましょう。'],
      }

    case 'mergeSelf':
      return { title: '同じブランチは取り込めません', body: [`今いる ${rejection.name} に、${rejection.name} 自身は取り込めません。`] }

    case 'alreadyMerged':
      return {
        title: 'すでに取り込まれています',
        body: [`${rejection.from} の変更は、もう ${rejection.into} に入っています。`],
      }

    case 'conflict':
      return {
        title: 'Conflict（衝突）が起きる操作です',
        body: [
          `${rejection.ours} と ${rejection.theirs} の両方で、同じファイル（${files(rejection.files)}）が変更されています。`,
          'このような状態を Conflict（衝突）といいます。本物の Git では、どちらの変更を残すか自分で決める必要があります。',
          'このアプリでは Conflict は扱わないので、別のファイルを変更して試してみましょう。',
        ],
      }

    case 'pushUpToDate':
      return { title: '送るものがありません', body: [`${GITHUB} の ${rejection.branch} は、${PC}と同じ状態です。`] }

    case 'pushBehind':
      return {
        title: `${GITHUB} にあなたの知らない変更があります`,
        body: [
          `${GITHUB} の ${rejection.branch} は、${PC}の ${rejection.branch} より先に進んでいます。`,
          'このまま送ると、その変更を上書きして消してしまうので、Git は送るのを止めます。',
          '先に pull して、その変更を取り込んでから push しましょう。',
        ],
      }

    case 'noRemoteBranch':
      return {
        title: `${GITHUB} にこのブランチがありません`,
        body: [`${rejection.branch} はまだ ${GITHUB} にないので、取り込むものがありません。先に push すると ${GITHUB} にもできます。`],
      }

    case 'prFromMain':
      return { title: 'main からは PR を作りません', body: ['PR は、作業用のブランチの変更を main に取り込んでもらうための依頼です。'] }

    case 'prNotPushed':
      return {
        title: 'まだ push していません',
        body: [`PR は ${GITHUB} の上で作ります。先に ${rejection.branch} を push して、${GITHUB} に送りましょう。`],
      }

    case 'prAlreadyOpen':
      return { title: 'PR はもうあります', body: [`${rejection.branch} の PR #${rejection.prId} がまだ終わっていません。`] }

    case 'prNothingToMerge':
      return {
        title: '取り込むものがありません',
        body: [`${GITHUB} の ${rejection.branch} の内容は、もう main に入っています。コミットして push してから作りましょう。`],
      }

    case 'prNotFound':
      return { title: 'PR が見つかりません', body: [`PR #${rejection.prId} はありません。`] }

    case 'prNotApproved':
      return { title: 'まだ承認されていません', body: ['チームメイトのレビューと承認が終わるまで、merge はできません。'] }

    case 'prAlreadyMerged':
      return { title: 'もう merge されています', body: [`PR #${rejection.prId} は merge 済みです。`] }

    case 'cannotDeleteBranch':
      return {
        title: 'このブランチは削除できません',
        body: ['削除できるのは、PR が merge された後の作業用ブランチだけです。'],
      }

    case 'teammateNoFile':
      return {
        title: 'チームメイトが変更できるファイルがありません',
        body: [
          'チームメイトは、あなたが変更していないファイルだけを変更します（Conflict を起こさないため）。',
          '今は3つのファイルすべてをあなたが変更中です。PR を merge するか、変更を取り消すと、また更新できるようになります。',
        ],
      }
  }
}

/** 実行はできるが、チーム開発では普通は避ける操作の確認 */
export function describeWarning(warning: Warning): ConfirmMessage {
  switch (warning.code) {
    case 'commitOnMain':
      return {
        title: 'main に直接コミットしようとしています',
        body: [
          'Git の仕組みとしては問題なくコミットできます。',
          'ただ、チーム開発では main を直接変えず、作業用のブランチでコミットして PR で取り込むのが普通です。',
        ],
        confirmLabel: 'このままコミットする',
        cancelLabel: 'やめておく',
      }

    case 'pushToMain':
      return {
        title: `${GITHUB} の main に直接送ろうとしています`,
        body: [
          'Git の仕組みとしては問題なく送れます。',
          `ただ、${GITHUB} の main は公開中のサイトです。チーム開発では、作業用のブランチを push して PR で取り込むのが普通です。`,
          '作業用のブランチ → push → PR → merge という流れになります。',
        ],
        confirmLabel: 'このまま push する',
        cancelLabel: 'やめておく',
      }

    case 'localMerge':
      return {
        title: `${PC}で merge しようとしています`,
        body: [
          `${warning.from} を ${warning.into} に取り込みます。Git の仕組みとしては問題なくできます。`,
          `ただ、チーム開発では ${GITHUB} で PR を作り、チームメイトに確認してもらってから merge するのが普通です。`,
        ],
        confirmLabel: 'このまま merge する',
        cancelLabel: 'やめておく',
      }
  }
}
