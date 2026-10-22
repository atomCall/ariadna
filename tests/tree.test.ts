import { describe, expect, it } from 'vitest'
import {
  addNode,
  addSibling,
  childrenOf,
  createMap,
  expandAncestors,
  indentNode,
  moveNode,
  outdentNode,
  pathTo,
  removeNode,
  reorderSibling,
  toggleCollapsed,
  visibleNodes,
} from '../src/domain/tree'

function build() {
  let map = createMap('Test', 'Raíz', 'map-1')
  const rootId = map.rootId
  let result = addNode(map, rootId, 'A', 0, 'a')
  map = result.map
  result = addNode(map, rootId, 'B', 1, 'b')
  map = result.map
  result = addNode(map, 'a', 'A1', 0, 'a1')
  map = result.map
  result = addNode(map, 'a', 'A2', 1, 'a2')
  map = result.map
  return { map, rootId }
}

describe('tree', () => {
  it('crea un mapa con raíz', () => {
    const map = createMap('T', 'Raíz', 'x')
    expect(map.nodes[map.rootId].text).toBe('Raíz')
    expect(childrenOf(map, map.rootId)).toEqual([])
  })

  it('añade hijos en orden', () => {
    const { map, rootId } = build()
    expect(childrenOf(map, rootId).map((node) => node.text)).toEqual(['A', 'B'])
  })

  it('añade hermanos justo después', () => {
    const { map } = build()
    const next = addSibling(map, 'a', 'A hermano').map
    expect(childrenOf(next, next.rootId).map((node) => node.text)).toEqual([
      'A',
      'A hermano',
      'B',
    ])
  })

  it('calcula el camino desde la raíz', () => {
    const { map } = build()
    expect(pathTo(map, 'a2').map((node) => node.text)).toEqual(['Raíz', 'A', 'A2'])
  })

  it('borra un nodo con todo su subárbol', () => {
    const { map } = build()
    const next = removeNode(map, 'a')
    expect(next.nodes.a).toBeUndefined()
    expect(next.nodes.a1).toBeUndefined()
    expect(childrenOf(next, next.rootId).map((node) => node.text)).toEqual(['B'])
  })

  it('no borra la raíz', () => {
    const { map, rootId } = build()
    expect(removeNode(map, rootId)).toBe(map)
  })

  it('impide mover un nodo dentro de su propio subárbol', () => {
    const { map } = build()
    expect(moveNode(map, 'a', 'a1')).toBe(map)
  })

  it('sangra un nodo bajo su hermano anterior', () => {
    const { map } = build()
    const next = indentNode(map, 'b')
    expect(next.nodes.b.parentId).toBe('a')
  })

  it('desangra un nodo al nivel del padre', () => {
    const { map } = build()
    const next = outdentNode(map, 'a1')
    expect(next.nodes.a1.parentId).toBe(map.rootId)
  })

  it('reordena hermanos', () => {
    const { map, rootId } = build()
    const next = reorderSibling(map, 'a', 1)
    expect(childrenOf(next, rootId).map((node) => node.text)).toEqual(['B', 'A'])
  })

  it('oculta el subárbol de un nodo colapsado', () => {
    const { map } = build()
    const next = toggleCollapsed(map, 'a')
    expect(visibleNodes(next).map((node) => node.text)).toEqual(['Raíz', 'A', 'B'])
  })

  it('expande los ancestros al seleccionar un nodo oculto', () => {
    const { map } = build()
    const next = expandAncestors(toggleCollapsed(map, 'a'), 'a2')
    expect(visibleNodes(next).map((node) => node.text)).toContain('A2')
  })
})
