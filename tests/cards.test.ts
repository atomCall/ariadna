import { describe, expect, it } from 'vitest'
import { addNode, createMap, setNote } from '../src/domain/tree'
import { cardsForSubtree, deriveCards } from '../src/domain/cards'

function build() {
  let map = createMap('Test', 'Raíz', 'map-1')
  const rootId = map.rootId
  let result = addNode(map, rootId, 'Derecho', 0, 'd')
  map = result.map
  result = addNode(map, 'd', 'Civil', 0, 'c')
  map = result.map
  result = addNode(map, 'c', 'Contratos', 0, 'k')
  map = result.map
  result = addNode(map, 'k', 'Consentimiento', 0, 'k1')
  map = result.map
  result = addNode(map, 'k', 'Objeto', 1, 'k2')
  map = result.map
  return { map, rootId }
}

describe('generación de tarjetas', () => {
  it('genera una tarjeta por nodo con hijos', () => {
    const { map } = build()
    const cards = deriveCards(map)
    const ids = cards.map((card) => card.id)
    expect(ids).toContain('k#children')
    expect(ids).toContain('c#children')
    expect(ids).toContain('d#children')
  })

  it('no genera tarjeta propia para las hojas', () => {
    const { map } = build()
    expect(deriveCards(map).map((card) => card.nodeId)).not.toContain('k1')
  })

  it('la respuesta lista los hijos', () => {
    const { map } = build()
    const card = deriveCards(map).find((item) => item.id === 'k#children')
    expect(card?.front).toBe('¿Qué cuelga de «Contratos»?')
    expect(card?.back).toBe('• Consentimiento\n• Objeto')
  })

  it('guarda el camino completo como contexto', () => {
    const { map } = build()
    const card = deriveCards(map).find((item) => item.id === 'k#children')
    expect(card?.path.map((id) => map.nodes[id].text)).toEqual([
      'Raíz',
      'Derecho',
      'Civil',
      'Contratos',
    ])
  })

  it('genera una tarjeta por cada hueco de la nota', () => {
    const { map } = build()
    const withNote = setNote(
      map,
      'k1',
      'El consentimiento debe ser {{libre}} y {{consciente}}.',
    )
    const cards = deriveCards(withNote).filter((card) => card.kind === 'cloze')
    expect(cards).toHaveLength(2)
    expect(cards[0].front).toBe('El consentimiento debe ser [ ... ] y consciente.')
    expect(cards[0].back).toBe('libre')
    expect(cards[1].front).toBe('El consentimiento debe ser libre y [ ... ].')
    expect(cards[1].back).toBe('consciente')
  })

  it('filtra las tarjetas de una rama', () => {
    const { map } = build()
    const cards = cardsForSubtree(map, 'c')
    expect(cards.every((card) => card.nodeId !== 'd')).toBe(true)
    expect(cards.some((card) => card.nodeId === 'k')).toBe(true)
  })
})
