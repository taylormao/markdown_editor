import type { OutlineNode } from '../types'
import { parseOutline } from '../lib/document-tree'

type Props = {
  content: string
}

function NodeList({ nodes }: { nodes: OutlineNode[] }) {
  return (
    <ul className="outline-tree">
      {nodes.map((node) => (
        <li key={node.id} data-level={node.level}>
          <div className="outline-row">
            <i />
            <span>{node.text}</span>
          </div>
          {node.children.length > 0 ? <NodeList nodes={node.children} /> : null}
        </li>
      ))}
    </ul>
  )
}

export function OutlineView({ content }: Props) {
  const tree = parseOutline(content)

  if (tree.length === 0) {
    return <div className="empty-stage">用标题和列表长出结构，大纲会在这里显现。</div>
  }

  return (
    <div className="outline-stage">
      <NodeList nodes={tree} />
    </div>
  )
}
