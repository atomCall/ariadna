import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { hierarchy, tree } from 'd3-hierarchy'
import type { MindMap, NodeId } from '../domain/types'
import { deriveCards } from '../domain/cards'
import { retention, type ReviewRecord } from '../domain/scheduler'
import { useStore } from '../state/store'

const ROW_GAP = 46
const DEPTH_GAP = 260
const NODE_H = 36
const MIN_W = 108
const MAX_W = 300

interface Item {
  id: NodeId
  text: string
  collapsed: boolean
  color: string | null
  kids: Item[]
}

interface Placed {
  id: NodeId
  text: string
  collapsed: boolean
  color: string | null
  x: number
  y: number
  w: number
  depth: number
  kids: number
}

function buildItems(map: MindMap, id: NodeId): Item {
  const node = map.nodes[id]
  const kids =
    node && !node.collapsed
      ? (map.order[id] ?? [])
          .filter((childId) => map.nodes[childId])
          .map((childId) => buildItems(map, childId))
      : []
  return {
    id,
    text: node ? node.text : '',
    collapsed: node ? node.collapsed : false,
    color: node ? node.color : null,
    kids,
  }
}

function nodeWidth(text: string): number {
  return Math.max(MIN_W, Math.min(MAX_W, text.length * 7.1 + 32))
}

function truncate(text: string, width: number): string {
  const room = Math.floor((width - 26) / 7.1)
  if (text.length <= room) return text
  return `${text.slice(0, Math.max(1, room - 1)).trimEnd()}…`
}

function heatMapOf(
  map: MindMap,
  reviews: Record<string, ReviewRecord>,
): Map<NodeId, number | null> {
  const buckets = new Map<NodeId, { total: number; count: number }>()
  for (const card of deriveCards(map)) {
    const value = retention(reviews[card.id])
    for (const id of card.path) {
      const bucket = buckets.get(id) ?? { total: 0, count: 0 }
      if (value !== null) {
        bucket.total += value
        bucket.count += 1
      }
      buckets.set(id, bucket)
    }
  }
  const out = new Map<NodeId, number | null>()
  for (const [id, bucket] of buckets) {
    out.set(id, bucket.count === 0 ? null : bucket.total / bucket.count)
  }
  return out
}

function heatColor(value: number | null): string {
  if (value === null) return '#f6f3ec'
  const clamped = Math.max(0, Math.min(1, value))
  const red = Math.round(226 - 160 * clamped)
  const green = Math.round(120 + 90 * clamped)
  const blue = Math.round(110 - 40 * clamped)
  return `rgb(${red} ${green} ${blue})`
}

interface Props {
  onOpenNote: (id: NodeId) => void
}

export function Canvas({ onOpenNote }: Props) {
  const map = useStore((state) => state.map)
  const selectedId = useStore((state) => state.selectedId)
  const editingId = useStore((state) => state.editingId)
  const reviews = useStore((state) => state.reviews)
  const heat = useStore((state) => state.heat)
  const store = useStore

  const wrapRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const [size, setSize] = useState({ w: 800, h: 600 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    const element = wrapRef.current
    if (!element) return
    element.focus()
    const observer = new ResizeObserver(() => {
      setSize({ w: element.clientWidth, h: element.clientHeight })
    })
    observer.observe(element)
    setSize({ w: element.clientWidth, h: element.clientHeight })
    return () => observer.disconnect()
  }, [])

  const layout = useMemo(() => {
    if (!map) return { placed: [] as Placed[], links: [] as { from: Placed; to: Placed }[] }
    const root = hierarchy<Item>(buildItems(map, map.rootId), (item) =>
      item.kids.length > 0 ? item.kids : undefined,
    )
    tree<Item>()
      .nodeSize([ROW_GAP, DEPTH_GAP])
      .separation((left, right) => (left.parent === right.parent ? 1 : 1.3))(root)

    const placed: Placed[] = []
    const byId = new Map<NodeId, Placed>()
    for (const point of root.descendants()) {
      const item: Placed = {
        id: point.data.id,
        text: point.data.text,
        collapsed: point.data.collapsed,
        color: point.data.color,
        x: point.y ?? 0,
        y: point.x ?? 0,
        w: nodeWidth(point.data.text),
        depth: point.depth,
        kids: map.order[point.data.id]?.length ?? 0,
      }
      placed.push(item)
      byId.set(item.id, item)
    }

    const links: { from: Placed; to: Placed }[] = []
    for (const link of root.links()) {
      const from = byId.get(link.source.data.id)
      const to = byId.get(link.target.data.id)
      if (from && to) links.push({ from, to })
    }
    return { placed, links }
  }, [map])

  const fit = useCallback(() => {
    if (layout.placed.length === 0) return
    const minX = Math.min(...layout.placed.map((node) => node.x - 10))
    const maxX = Math.max(...layout.placed.map((node) => node.x + node.w + 10))
    const minY = Math.min(...layout.placed.map((node) => node.y - NODE_H))
    const maxY = Math.max(...layout.placed.map((node) => node.y + NODE_H))
    const pad = 70
    const k = Math.max(
      0.25,
      Math.min(
        1.15,
        (size.w - pad * 2) / Math.max(1, maxX - minX),
        (size.h - pad * 2) / Math.max(1, maxY - minY),
      ),
    )
    setView({
      k,
      x: (size.w - (maxX - minX) * k) / 2 - minX * k,
      y: (size.h - (maxY - minY) * k) / 2 - minY * k,
    })
  }, [layout, size])

  useEffect(() => {
    // El encuadre depende del tamaño del lienzo, así que se recalcula al abrirlo
    // o al cambiar de mapa.
    // oxlint-disable-next-line react/set-state-in-effect
    fit()
  }, [map?.id, fit])

  const heatValues = useMemo(() => (map ? heatMapOf(map, reviews) : new Map()), [map, reviews])
  const positions = useMemo(() => {
    const out = new Map<NodeId, Placed>()
    for (const node of layout.placed) out.set(node.id, node)
    return out
  }, [layout])

  const zoomAt = (factor: number, cx: number, cy: number) => {
    setView((current) => {
      const k = Math.max(0.2, Math.min(2.4, current.k * factor))
      return {
        k,
        x: cx - ((cx - current.x) * k) / current.k,
        y: cy - ((cy - current.y) * k) / current.k,
      }
    })
  }

  const onWheel = (event: React.WheelEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    const state = store.getState()
    if (!state.map || state.editingId) return
    const id = state.selectedId ?? state.map.rootId
    const index = layout.placed.findIndex((node) => node.id === id)

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      if (event.shiftKey) state.redo()
      else state.undo()
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      state.addChild()
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      state.addSibling()
      return
    }
    if (event.key === 'F2') {
      event.preventDefault()
      state.startEditing(id)
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      if (id !== state.map.rootId) state.removeNode(id)
      return
    }
    if (event.key === ' ') {
      event.preventDefault()
      state.toggleCollapsed(id)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      if (event.altKey) {
        state.reorder(id, delta)
        return
      }
      const next = layout.placed[Math.max(0, Math.min(layout.placed.length - 1, index + delta))]
      if (next) state.select(next.id)
      return
    }
    if (event.altKey && event.key === 'ArrowRight') {
      event.preventDefault()
      state.indent(id)
      return
    }
    if (event.altKey && event.key === 'ArrowLeft') {
      event.preventDefault()
      state.outdent(id)
      return
    }
    if (event.key.toLowerCase() === 'n' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      onOpenNote(id)
    }
  }

  const editing = editingId ? positions.get(editingId) : undefined

  return (
    <div
      className="canvas"
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        if ((event.target as Element).closest('button, input, textarea, .node')) return
        const host = event.currentTarget as HTMLElement
        host.focus()
        host.setPointerCapture(event.pointerId)
        drag.current = { x: event.clientX, y: event.clientY, ox: view.x, oy: view.y }
        store.getState().select(null)
      }}
      onPointerMove={(event) => {
        if (!drag.current) return
        setView((current) => ({
          ...current,
          x: drag.current!.ox + event.clientX - drag.current!.x,
          y: drag.current!.oy + event.clientY - drag.current!.y,
        }))
      }}
      onPointerUp={() => {
        drag.current = null
      }}
    >
      <svg width="100%" height="100%">
        <defs>
          <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#d9d3c6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {layout.links.map((link) => {
            const x1 = link.from.x + link.from.w
            const y1 = link.from.y
            const x2 = link.to.x
            const y2 = link.to.y
            const bend = Math.max(28, (x2 - x1) / 2)
            return (
              <path
                key={`${link.from.id}-${link.to.id}`}
                className="link"
                d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`}
              />
            )
          })}

          {layout.placed.map((node) => {
            const isRoot = node.depth === 0
            const isSelected = node.id === selectedId
            const value = heatValues.get(node.id) ?? null
            const fill = isRoot
              ? '#22243b'
              : heat
                ? heatColor(value)
                : node.color
                  ? `${node.color}22`
                  : '#fffdf8'
            const stroke = isSelected ? '#e2453f' : (node.color ?? '#d9d3c6')
            return (
              <g
                key={node.id}
                className="node"
                transform={`translate(${node.x} ${node.y - NODE_H / 2})`}
                onClick={(event) => {
                  event.stopPropagation()
                  wrapRef.current?.focus()
                  store.getState().select(node.id)
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation()
                  store.getState().startEditing(node.id)
                }}
              >
                <rect
                  className="node-box"
                  width={node.w}
                  height={NODE_H}
                  rx={isRoot ? 14 : 10}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isSelected ? 2 : 1.2}
                />
                {node.color && !isRoot ? (
                  <rect x={0} y={0} width={4} height={NODE_H} rx={2} fill={node.color} />
                ) : null}
                <text
                  className="node-text"
                  x={14}
                  y={NODE_H / 2 + 5}
                  fill={isRoot ? '#f7f2e7' : '#232323'}
                  fontWeight={isRoot ? 600 : 400}
                >
                  {truncate(node.text, node.w)}
                </text>
                {node.kids > 0 ? (
                  <g
                    className="node-toggle"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation()
                      store.getState().toggleCollapsed(node.id)
                    }}
                  >
                    <circle
                      cx={node.w - 13}
                      cy={NODE_H / 2}
                      r={9}
                      fill={isRoot ? '#f7f2e7' : '#22243b'}
                      opacity={node.collapsed ? 1 : 0.75}
                    />
                    <text
                      x={node.w - 13}
                      y={NODE_H / 2 + 4}
                      textAnchor="middle"
                      fontSize={10}
                      fill={isRoot ? '#22243b' : '#f7f2e7'}
                    >
                      {node.collapsed ? node.kids : '-'}
                    </text>
                  </g>
                ) : null}
              </g>
            )
          })}
        </g>
      </svg>

      {editing ? (
        <NodeInput
          key={editing.id}
          text={editing.text}
          left={view.x + editing.x * view.k}
          top={view.y + (editing.y - NODE_H / 2) * view.k}
          width={Math.max(120, editing.w * view.k)}
          height={NODE_H * view.k}
          onDone={(text, action) => {
            const state = store.getState()
            if (text.trim().length > 0 && text !== editing.text) state.renameNode(editing.id, text)
            state.stopEditing()
            if (action === 'child') state.addChild()
            else if (action === 'sibling') state.addSibling()
            wrapRef.current?.focus()
          }}
        />
      ) : null}

      <div className="canvas-tools">
        <button type="button" onClick={fit} title="Centrar el mapa">
          Centrar
        </button>
        <button type="button" onClick={() => zoomAt(1.15, size.w / 2, size.h / 2)} title="Acercar">
          +
        </button>
        <button
          type="button"
          onClick={() => zoomAt(1 / 1.15, size.w / 2, size.h / 2)}
          title="Alejar"
        >
          -
        </button>
      </div>
    </div>
  )
}

interface NodeInputProps {
  text: string
  left: number
  top: number
  width: number
  height: number
  onDone: (text: string, action: 'none' | 'child' | 'sibling') => void
}

function NodeInput({ text, left, top, width, height, onDone }: NodeInputProps) {
  const [value, setValue] = useState(text)
  const ref = useRef<HTMLInputElement>(null)
  const done = useRef(false)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  const finish = (action: 'none' | 'child' | 'sibling') => {
    if (done.current) return
    done.current = true
    onDone(value, action)
  }

  return (
    <input
      ref={ref}
      className="node-input"
      style={{ left, top, width, height }}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish('none')}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Enter') {
          event.preventDefault()
          finish('none')
        } else if (event.key === 'Tab') {
          event.preventDefault()
          finish('child')
        } else if (event.key === 'Escape') {
          event.preventDefault()
          done.current = true
          onDone(text, 'none')
        }
      }}
    />
  )
}

