import { nanoid } from 'nanoid'
import type { MindMap, MindNode, NodeId } from './types'

export const PALETTE = [
  '#e2453f',
  '#e08a2e',
  '#c9a227',
  '#3f9d5a',
  '#2f8f9d',
  '#3a6fd8',
  '#7a5ad8',
  '#c04f9b',
]

export function createMap(
  title = 'Mapa sin título',
  rootText = 'Tema central',
  id: string = nanoid(),
): MindMap {
  const rootId = nanoid()
  const now = Date.now()
  const root: MindNode = {
    id: rootId,
    parentId: null,
    text: rootText,
    note: '',
    color: null,
    collapsed: false,
  }
  return {
    id,
    title,
    rootId,
    nodes: { [rootId]: root },
    order: { [rootId]: [] },
    createdAt: now,
    updatedAt: now,
  }
}

function touch(map: MindMap): MindMap {
  return { ...map, updatedAt: Date.now() }
}

export function parentOf(map: MindMap, id: NodeId): MindNode | null {
  const node = map.nodes[id]
  if (!node || node.parentId === null) return null
  return map.nodes[node.parentId] ?? null
}

export function childrenOf(map: MindMap, id: NodeId): MindNode[] {
  const ids = map.order[id] ?? []
  return ids.map((childId) => map.nodes[childId]).filter(Boolean) as MindNode[]
}

export function pathTo(map: MindMap, id: NodeId): MindNode[] {
  const path: MindNode[] = []
  let current: MindNode | undefined = map.nodes[id]
  while (current) {
    path.unshift(current)
    current = current.parentId ? map.nodes[current.parentId] : undefined
  }
  return path
}

export function descendants(map: MindMap, id: NodeId): NodeId[] {
  const out: NodeId[] = []
  const stack = [...(map.order[id] ?? [])]
  while (stack.length > 0) {
    const current = stack.pop() as NodeId
    out.push(current)
    for (const child of map.order[current] ?? []) stack.push(child)
  }
  return out
}

export function isDescendant(map: MindMap, ancestorId: NodeId, maybeChildId: NodeId): boolean {
  return descendants(map, ancestorId).includes(maybeChildId)
}

export function visibleNodes(map: MindMap): MindNode[] {
  const out: MindNode[] = []
  const walk = (id: NodeId) => {
    const node = map.nodes[id]
    if (!node) return
    out.push(node)
    if (node.collapsed) return
    for (const childId of map.order[id] ?? []) walk(childId)
  }
  walk(map.rootId)
  return out
}

export function addNode(
  map: MindMap,
  parentId: NodeId,
  text: string,
  index?: number,
  id: NodeId = nanoid(),
): { map: MindMap; id: NodeId } {
  const parent = map.nodes[parentId]
  if (!parent) return { map, id }

  const node: MindNode = {
    id,
    parentId,
    text,
    note: '',
    color: null,
    collapsed: false,
  }
  const siblings = [...(map.order[parentId] ?? [])]
  const at = index === undefined ? siblings.length : Math.max(0, Math.min(index, siblings.length))
  siblings.splice(at, 0, id)

  return {
    map: touch({
      ...map,
      nodes: { ...map.nodes, [id]: node },
      order: { ...map.order, [parentId]: siblings, [id]: [] },
    }),
    id,
  }
}

export function addChild(
  map: MindMap,
  parentId: NodeId,
  text = 'Nuevo nodo',
): { map: MindMap; id: NodeId } {
  return addNode(map, parentId, text)
}

export function addSibling(
  map: MindMap,
  id: NodeId,
  text = 'Nuevo nodo',
): { map: MindMap; id: NodeId } {
  const node = map.nodes[id]
  if (!node) return { map, id }
  if (node.parentId === null) return addNode(map, node.id, text)
  const siblings = map.order[node.parentId] ?? []
  const index = siblings.indexOf(id)
  return addNode(map, node.parentId, text, index + 1)
}

export function renameNode(map: MindMap, id: NodeId, text: string): MindMap {
  const node = map.nodes[id]
  if (!node || node.text === text) return map
  return touch({ ...map, nodes: { ...map.nodes, [id]: { ...node, text } } })
}

export function setNote(map: MindMap, id: NodeId, note: string): MindMap {
  const node = map.nodes[id]
  if (!node) return map
  return touch({ ...map, nodes: { ...map.nodes, [id]: { ...node, note } } })
}

export function setColor(map: MindMap, id: NodeId, color: string | null): MindMap {
  const node = map.nodes[id]
  if (!node) return map
  return touch({ ...map, nodes: { ...map.nodes, [id]: { ...node, color } } })
}

export function toggleCollapsed(map: MindMap, id: NodeId): MindMap {
  const node = map.nodes[id]
  if (!node) return map
  return touch({ ...map, nodes: { ...map.nodes, [id]: { ...node, collapsed: !node.collapsed } } })
}

export function expandAncestors(map: MindMap, id: NodeId): MindMap {
  const path = pathTo(map, id)
  let changed = false
  const nodes = { ...map.nodes }
  for (const node of path) {
    if (node.collapsed) {
      nodes[node.id] = { ...node, collapsed: false }
      changed = true
    }
  }
  return changed ? touch({ ...map, nodes }) : map
}

export function removeNode(map: MindMap, id: NodeId): MindMap {
  const node = map.nodes[id]
  if (!node || id === map.rootId) return map

  const doomed = [id, ...descendants(map, id)]
  const nodes = { ...map.nodes }
  const order = { ...map.order }
  for (const deadId of doomed) {
    delete nodes[deadId]
    delete order[deadId]
  }
  const parentId = node.parentId as NodeId
  order[parentId] = (order[parentId] ?? []).filter((childId) => childId !== id)

  return touch({ ...map, nodes, order })
}

export function moveNode(
  map: MindMap,
  id: NodeId,
  newParentId: NodeId,
  index?: number,
): MindMap {
  const node = map.nodes[id]
  const newParent = map.nodes[newParentId]
  if (!node || !newParent || id === map.rootId) return map
  if (id === newParentId || isDescendant(map, id, newParentId)) return map
  if (node.parentId === null) return map

  const order = { ...map.order }
  order[node.parentId] = (order[node.parentId] ?? []).filter((childId) => childId !== id)
  const target = [...(order[newParentId] ?? [])]
  const at = index === undefined ? target.length : Math.max(0, Math.min(index, target.length))
  target.splice(at, 0, id)
  order[newParentId] = target

  return touch({
    ...map,
    nodes: { ...map.nodes, [id]: { ...node, parentId: newParentId } },
    order,
  })
}

export function reorderSibling(map: MindMap, id: NodeId, delta: number): MindMap {
  const node = map.nodes[id]
  if (!node || node.parentId === null) return map
  const siblings = map.order[node.parentId] ?? []
  const from = siblings.indexOf(id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= siblings.length) return map
  const next = [...siblings]
  next.splice(from, 1)
  next.splice(to, 0, id)
  return touch({ ...map, order: { ...map.order, [node.parentId]: next } })
}

export function indentNode(map: MindMap, id: NodeId): MindMap {
  const node = map.nodes[id]
  if (!node || node.parentId === null) return map
  const siblings = map.order[node.parentId] ?? []
  const index = siblings.indexOf(id)
  if (index <= 0) return map
  return moveNode(map, id, siblings[index - 1])
}

export function outdentNode(map: MindMap, id: NodeId): MindMap {
  const node = map.nodes[id]
  if (!node || node.parentId === null) return map
  const parent = map.nodes[node.parentId]
  if (!parent || parent.parentId === null) return map
  const parentSiblings = map.order[parent.parentId] ?? []
  const index = parentSiblings.indexOf(parent.id)
  return moveNode(map, id, parent.parentId, index + 1)
}

export function countNodes(map: MindMap): number {
  return Object.keys(map.nodes).length
}
