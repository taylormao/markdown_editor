import hljs from 'highlight.js/lib/common'

export function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const name = lang.trim()
  let html = ''
  try {
    html = name && hljs.getLanguage(name) ? hljs.highlight(code, { language: name }).value : hljs.highlightAuto(code).value
  } catch {
    html = ''
  }

  return (
    <pre className="code-block" data-lang={name || undefined}>
      {name ? <span className="code-lang">{name}</span> : null}
      {html ? <code dangerouslySetInnerHTML={{ __html: html }} /> : <code>{code}</code>}
    </pre>
  )
}
