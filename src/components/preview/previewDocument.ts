import type { Files } from '../../engine'

/** スクリプトの中に </script> があっても、埋め込んだ script タグが途中で閉じないようにする */
function escapeScript(code: string): string {
  return code.replace(/<\/script/gi, '<\\/script')
}

function escapeStyle(css: string): string {
  return css.replace(/<\/style/gi, '<\\/style')
}

/**
 * 3つのファイルを、iframe にそのまま渡せる1枚の HTML にまとめる。
 * style.css は </head> の直前、script.js は </body> の直前に入れる（見つからなければ先頭・末尾）。
 */
export function buildPreviewDocument(files: Files): string {
  const style = `<style>\n${escapeStyle(files['style.css'])}\n</style>`
  const script = `<script>\n${escapeScript(files['script.js'])}\n</script>`
  let html = files['index.html']
  html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${style}\n</head>`) : `${style}\n${html}`
  html = /<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${script}\n</body>`) : `${html}\n${script}`
  return html
}
