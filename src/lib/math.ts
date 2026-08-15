import katex from 'katex'

export function renderMath(tex: string, display = false): string {
  try {
    return katex.renderToString(tex, {
      displayMode: display,
      throwOnError: false,
      strict: 'ignore',
      output: 'html',
    })
  } catch {
    return tex
  }
}

export function eachMath(
  text: string,
  visit: (hit: { from: number; to: number; tex: string; display: boolean }) => void,
) {
  const re = /\$\$([\s\S]+?)\$\$|\$(?!\$)(?!\s)([^$\n]*?[^\s$])\$/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    if (match[0].startsWith('\\')) continue
    const display = match[1] != null
    visit({
      from: match.index,
      to: match.index + match[0].length,
      tex: (display ? match[1] : match[2]) ?? '',
      display,
    })
  }
}
