import { describe, expect, it } from 'vitest'
import { parseOutline, toMarkdown } from '../src/domain/markdown'
import { childrenOf } from '../src/domain/tree'
import type { MindMap, NodeId } from '../src/domain/types'

function outline(map: MindMap, id: NodeId, depth = 0): string[] {
  const lines = ['  '.repeat(depth) + map.nodes[id].text]
  for (const childId of map.order[id] ?? []) {
    lines.push(...outline(map, childId, depth + 1))
  }
  return lines
}

describe('markdown', () => {
  it('lee listas anidadas', () => {
    const md = ['# Derecho', '- Civil', '  - Contratos', '    - Consentimiento', '- Penal'].join(
      '\n',
    )
    const map = parseOutline(md)
    expect(map.title).toBe('Derecho')
    expect(map.nodes[map.rootId].text).toBe('Derecho')
    const civil = childrenOf(map, map.rootId)[0]
    const contratos = childrenOf(map, civil.id)[0]
    expect(contratos.text).toBe('Contratos')
    expect(childrenOf(map, contratos.id)[0].text).toBe('Consentimiento')
  })

  it('lee encabezados como niveles', () => {
    const md = ['# Tema', '## Uno', '### Uno.A', '## Dos'].join('\n')
    const map = parseOutline(md)
    const roots = childrenOf(map, map.rootId)
    expect(roots.map((node) => node.text)).toEqual(['Uno', 'Dos'])
    expect(childrenOf(map, roots[0].id).map((node) => node.text)).toEqual(['Uno.A'])
  })

  it('adjunta notas con cita', () => {
    const md = ['# Tema', '- Nodo', '  > primera linea', '  > segunda linea'].join('\n')
    const map = parseOutline(md)
    const node = childrenOf(map, map.rootId)[0]
    expect(node.note).toBe('primera linea\nsegunda linea')
  })

  it('exporta e importa la misma estructura', () => {
    const md = ['# Tema', '- Uno', '  - Uno.A', '  - Uno.B', '- Dos'].join('\n')
    const first = parseOutline(md)
    const second = parseOutline(toMarkdown(first))
    expect(outline(second, second.rootId)).toEqual(outline(first, first.rootId))
    expect(second.title).toBe(first.title)
  })

  it('conserva las notas en el viaje de ida y vuelta', () => {
    const md = ['# Tema', '- Uno', '  > detalle importante'].join('\n')
    const first = parseOutline(md)
    const second = parseOutline(toMarkdown(first))
    const node = childrenOf(second, second.rootId)[0]
    expect(node.note).toBe('detalle importante')
  })
})
