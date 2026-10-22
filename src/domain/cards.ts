import type { Card, MindMap, NodeId } from './types'
import { pathTo } from './tree'

const CLOZE_PATTERN = /\{\{([^{}]+)\}\}/g

export function orderedIds(map: MindMap): NodeId[] {
  const out: NodeId[] = []
  const walk = (id: NodeId) => {
    if (!map.nodes[id]) return
    out.push(id)
    for (const childId of map.order[id] ?? []) walk(childId)
  }
  walk(map.rootId)
  return out
}

export function hasCloze(note: string): boolean {
  CLOZE_PATTERN.lastIndex = 0
  const found = CLOZE_PATTERN.test(note)
  CLOZE_PATTERN.lastIndex = 0
  return found
}

export function clozeParts(note: string): { text: string; hidden: string }[] {
  const parts: { text: string; hidden: string }[] = []
  const matches = [...note.matchAll(CLOZE_PATTERN)]
  for (const match of matches) {
    const hidden = match[1].trim()
    if (hidden.length === 0) continue
    parts.push({ text: match[0], hidden })
  }
  return parts
}

export function deriveCards(map: MindMap): Card[] {
  const cards: Card[] = []

  for (const id of orderedIds(map)) {
    const node = map.nodes[id]
    const title = node.text.trim()
    if (title.length === 0) continue

    const childIds = map.order[id] ?? []
    if (childIds.length > 0) {
      const answers = childIds
        .map((childId) => map.nodes[childId]?.text.trim())
        .filter((text): text is string => Boolean(text))
      if (answers.length > 0) {
        cards.push({
          id: `${id}#children`,
          nodeId: id,
          kind: 'children',
          front: `¿Qué cuelga de «${title}»?`,
          back: answers.map((answer) => `• ${answer}`).join('\n'),
          path: pathTo(map, id).map((item) => item.id),
        })
      }
    }

    if (node.note.trim().length === 0) continue
    const matches = [...node.note.matchAll(CLOZE_PATTERN)]
    matches.forEach((match, index) => {
      const hidden = match[1].trim()
      if (hidden.length === 0) return

      let front = ''
      let cursor = 0
      matches.forEach((item, position) => {
        const start = item.index ?? 0
        front += node.note.slice(cursor, start)
        front += position === index ? '[ ... ]' : item[1].trim()
        cursor = start + item[0].length
      })
      front += node.note.slice(cursor)

      cards.push({
        id: `${id}#cloze${index}`,
        nodeId: id,
        kind: 'cloze',
        front,
        back: hidden,
        path: pathTo(map, id).map((item) => item.id),
      })
    })
  }

  return cards
}

export function cardsForNode(map: MindMap, id: NodeId): Card[] {
  return deriveCards(map).filter((card) => card.nodeId === id)
}

export function cardsForSubtree(map: MindMap, id: NodeId): Card[] {
  const allowed = new Set<NodeId>([id])
  const walk = (nodeId: NodeId) => {
    for (const childId of map.order[nodeId] ?? []) {
      allowed.add(childId)
      walk(childId)
    }
  }
  walk(id)
  return deriveCards(map).filter((card) => allowed.has(card.nodeId))
}
