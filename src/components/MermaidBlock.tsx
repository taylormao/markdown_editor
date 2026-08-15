import { useEffect, useState } from 'react'
import { renderMermaid } from '../lib/mermaid'

export function MermaidBlock({ source }: { source: string }) {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setError('')
    renderMermaid(source)
      .then((next) => {
        if (alive) setSvg(next)
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : '图表无法渲染')
      })
    return () => {
      alive = false
    }
  }, [source])

  if (error) return <pre className="mermaid-error">{error}</pre>
  if (!svg) return <div className="mermaid-wait">正在绘制图表…</div>
  return <div className="mermaid-frame" dangerouslySetInnerHTML={{ __html: svg }} />
}
