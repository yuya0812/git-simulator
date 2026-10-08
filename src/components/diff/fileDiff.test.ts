import { describe, expect, it } from 'vitest'
import { INITIAL_FILES } from '../../engine'
import { buildPreviewDocument } from '../preview/previewDocument'
import { diffFiles } from './fileDiff'

describe('Diff', () => {
  it('変わったファイルだけを、追加・削除・前後の行に分けて返す', () => {
    const after = { ...INITIAL_FILES, 'index.html': INITIAL_FILES['index.html'].replace('ギット たろう', 'やまだ はなこ') }
    const diffs = diffFiles(INITIAL_FILES, after)
    expect(diffs.map((d) => d.file)).toEqual(['index.html'])
    const lines = diffs[0].hunks.flat()
    expect(lines).toContainEqual({ kind: 'remove', text: '  <h1>ギット たろう</h1>' })
    expect(lines).toContainEqual({ kind: 'add', text: '  <h1>やまだ はなこ</h1>' })
    expect(lines.filter((l) => l.kind === 'context').length).toBe(4)
  })

  it('同じなら何も返さない', () => {
    expect(diffFiles(INITIAL_FILES, { ...INITIAL_FILES })).toEqual([])
  })
})

describe('プレビュー', () => {
  it('style.css を head に、script.js を body の最後に埋め込む', () => {
    const html = buildPreviewDocument(INITIAL_FILES)
    expect(html.indexOf('<style>')).toBeLessThan(html.indexOf('</head>'))
    expect(html.indexOf('<script>')).toBeGreaterThan(html.indexOf('<span id="count">'))
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('</body>'))
    expect(html).toContain('border-radius: 999px')
    expect(html).toContain('count += 1')
  })

  it('head や body が無い HTML でも埋め込める', () => {
    const html = buildPreviewDocument({ ...INITIAL_FILES, 'index.html': '<h1>だけ</h1>' })
    expect(html.startsWith('<style>')).toBe(true)
    expect(html.trimEnd().endsWith('</script>')).toBe(true)
  })

  it('script.js の中の </script> で、タグが途中で閉じない', () => {
    const html = buildPreviewDocument({ ...INITIAL_FILES, 'script.js': 'const s = "</script>";' })
    expect(html).toContain('const s = "<\\/script>";')
  })
})
