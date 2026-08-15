import { useMemo } from 'react'
import type { OutlineNode } from '../types'
import { parseOutline } from '../lib/document-tree'

type Laid = {
  id: string
  text: string
  x: number
  y: number
  depth: number
}

const NODE_W = 168
const NODE_H = 44
const GAP_X = 72
const GAP_Y = 22

function flatten(nodes: OutlineNode[], depth = 0): OutlineNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children, depth + 1)])
}

function layout(nodes: OutlineNode[]): Laid[] {
  const leaves = (node: OutlineNode): number =>
    node.children.length === 0 ? 1 : node.children.reduce((sum, child) => sum + leaves(child), 0)

  const result: Laid[] = []
  const walk = (list: OutlineNode[], depth: number, startY: number) => {
    let cursor = startY
    list.forEach((node) => {
      const span = leaves(node)
      const height = span * (NODE_H + GAP_Y)
      result.push({
        id: node.id,
        text: node.text,
        x: 48 + depth * (NODE_W + GAP_X),
        y: cursor + height / 2 - NODE_H / 2,
        depth,
      })
      walk(node.children, depth + 1, cursor)
      cursor += height
    })
  }
  walk(nodes, 0, 36)
  return result
}

export function MindMapView({ content }: { content: string }) {
  const tree = useMemo(() => parseOutline(content), [content])
  const nodes = useMemo(() => layout(tree), [tree])
  const lookup = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])

  const edges = useMemo(() => {
    const lines: { from: Laid; to: Laid }[] = []
    const walk = (list: OutlineNode[]) => {
      list.forEach((node) => {
        const from = lookup.get(node.id)
        node.children.forEach((child) => {
          const to = lookup.get(child.id)
          if (from && to) lines.push({ from, to })
        })
        walk(node.children)
      })
    }
    walk(tree)
    return lines
  }, [lookup, tree])

  if (tree.length === 0) {
    return <div className="empty-stage">先写几个标题，导图就会从同一棵树里长出来。</div>
  }

  const width = Math.max(720, ...nodes.map((node) => node.x + NODE_W + 80))
  const height = Math.max(420, ...nodes.map((node) => node.y + NODE_H + 80))

  return (
    <div className="map-stage">
      <svg width={width} height={height} className="map-canvas">
        {edges.map(({ from, to }) => {
          const x1 = from.x + NODE_W
          const y1 = from.y + NODE_H / 2
          const x2 = to.x
          const y2 = to.y + NODE_H / 2
          const mid = (x1 + x2) / 2
          return (
            <path
              key={`${from.id}-${to.id}`}
              d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke="var(--line)"
              strokeWidth="1.25"
            />
          )
        })}
        {nodes.map((node) => (
          <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
            <rect
              width={NODE_W}
              height={NODE_H}
              rx="12"
              fill={node.depth === 0 ? 'var(--map-root)' : 'var(--map-node)'}
              stroke="var(--line-strong)"
            />
            <text
              x={NODE_W / 2}
              y={NODE_H / 2 + 5}
              textAnchor="middle"
              fill="var(--ink)"
              fontSize={node.depth === 0 ? 14 : 13}
              fontFamily="var(--font-sans)"
            >
              {node.text.length > 12 ? `${node.text.slice(0, 12)}…` : node.text}
            </text>
          </g>
        ))}
      </svg>
      <p className="map-meta">{flatten(tree).length} 个节点 · 与文稿同一棵树</p>
    </div>
  )
}
