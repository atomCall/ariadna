import type { MindMap, NodeId } from './types'
import { addNode, createMap, expandAncestors, renameNode, setNote } from './tree'

interface Frame {
  indent: number
  id: NodeId
}

const BULLET = /^(\s*)(?:[-*+]|\d+\.)\s+(.*)$/
const HEADING = /^(#{1,6})\s+(.*)$/
const QUOTE = /^\s*>\s?(.*)$/
const FENCE = /^\s*```/

function cleanInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .trim()
}

export function parseOutline(markdown: string, fallbackTitle = 'Mapa importado'): MindMap {
  let map = createMap(fallbackTitle)
  const stack: Frame[] = []
  let bulletIndents: number[] = []
  let headingIndent = -1
  let lastNodeId: NodeId = map.rootId
  let inFence = false
  let sawContent = false

  for (const rawLine of markdown.split(/\r?\n/)) {
    if (FENCE.test(rawLine)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const line = rawLine.replace(/\t/g, '    ')
    if (line.trim().length === 0) continue

    const heading = line.match(HEADING)
    if (heading) {
      const level = heading[1].length
      const text = cleanInline(heading[2])
      if (level === 1 && !sawContent) {
        map = renameNode(map, map.rootId, text)
        map = { ...map, title: text }
        headingIndent = 0
        stack.length = 0
        bulletIndents = []
        lastNodeId = map.rootId
        sawContent = true
        continue
      }
      headingIndent = level
      while (stack.length > 0 && stack[stack.length - 1].indent >= level) stack.pop()
      const parentId = stack.length > 0 ? stack[stack.length - 1].id : map.rootId
      const added = addNode(map, parentId, text)
      map = added.map
      stack.push({ indent: level, id: added.id })
      bulletIndents = []
      lastNodeId = added.id
      sawContent = true
      continue
    }

    const quote = line.match(QUOTE)
    if (quote) {
      const node = map.nodes[lastNodeId]
      if (node) {
        const note = node.note.length > 0 ? `${node.note}\n${quote[1]}` : quote[1]
        map = setNote(map, lastNodeId, note)
      }
      continue
    }

    const bullet = line.match(BULLET)
    if (bullet) {
      const rawIndent = bullet[1].length
      const text = cleanInline(bullet[2])
      while (bulletIndents.length > 0 && rawIndent <= bulletIndents[bulletIndents.length - 1]) {
        bulletIndents.pop()
      }
      bulletIndents.push(rawIndent)
      const nesting = bulletIndents.length - 1
      const effective = headingIndent + 1 + nesting
      while (stack.length > 0 && stack[stack.length - 1].indent >= effective) stack.pop()
      const parentId = stack.length > 0 ? stack[stack.length - 1].id : map.rootId
      const added = addNode(map, parentId, text)
      map = added.map
      stack.push({ indent: effective, id: added.id })
      lastNodeId = added.id
      sawContent = true
      continue
    }

    if (!sawContent) continue
    const node = map.nodes[lastNodeId]
    if (node) {
      const note = node.note.length > 0 ? `${node.note}\n${rawLine.trim()}` : rawLine.trim()
      map = setNote(map, lastNodeId, note)
    }
  }

  return expandAncestors(map, map.rootId)
}

export function toMarkdown(map: MindMap): string {
  const lines: string[] = [`# ${map.title}`, '']
  const walk = (id: NodeId, depth: number) => {
    const node = map.nodes[id]
    if (!node) return
    if (id !== map.rootId) {
      const pad = '  '.repeat(depth)
      lines.push(`${pad}- ${node.text}`)
      const note = node.note.trim()
      if (note.length > 0) {
        for (const noteLine of note.split(/\r?\n/)) {
          lines.push(`${pad}  > ${noteLine}`)
        }
      }
    }
    for (const childId of map.order[id] ?? []) {
      walk(childId, id === map.rootId ? 0 : depth + 1)
    }
  }
  walk(map.rootId, 0)
  lines.push('')
  return lines.join('\n')
}
