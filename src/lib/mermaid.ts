let ready: Promise<typeof import('mermaid')['default']> | null = null
let seq = 0

function theme(): 'default' | 'dark' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default'
}

async function api() {
  if (!ready) {
    ready = import('mermaid').then((mod) => {
      mod.default.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: theme(),
        fontFamily: 'Inter, "PingFang SC", sans-serif',
      })
      return mod.default
    })
  }
  return ready
}

export async function renderMermaid(source: string): Promise<string> {
  const mermaid = await api()
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: theme(),
    fontFamily: 'Inter, "PingFang SC", sans-serif',
  })
  const id = `folio-mmd-${++seq}-${Date.now().toString(36)}`
  const { svg } = await mermaid.render(id, source.trim())
  return svg
}
