import { useMemo, useState } from 'react'
import { cardsForSubtree } from '../domain/cards'
import { PALETTE, linksOf } from '../domain/tree'
import { isDue, retention } from '../domain/scheduler'
import { useStore } from '../state/store'

interface Props {
  nodeId: string
  onClose: () => void
}

export function NotePanel({ nodeId, onClose }: Props) {
  const map = useStore((state) => state.map)
  const reviews = useStore((state) => state.reviews)
  const linkMode = useStore((state) => state.linkMode)
  const store = useStore
  const node = map?.nodes[nodeId]
  const [draft, setDraft] = useState<{ id: string; text: string; note: string } | null>(null)
  const active = draft && draft.id === nodeId ? draft : null
  const textValue = active ? active.text : (node?.text ?? '')
  const noteValue = active ? active.note : (node?.note ?? '')

  const stats = useMemo(() => {
    if (!map) return { total: 0, due: 0, score: null as number | null }
    const cards = cardsForSubtree(map, nodeId)
    const values = cards
      .map((card) => retention(reviews[card.id]))
      .filter((value): value is number => value !== null)
    return {
      total: cards.length,
      due: cards.filter((card) => isDue(reviews[card.id])).length,
      score: values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length,
    }
  }, [map, nodeId, reviews])

  const arrows = useMemo(() => {
    if (!map) return []
    return linksOf(map, nodeId).map((link) => {
      const outgoing = link.from === nodeId
      const otherId = outgoing ? link.to : link.from
      return { id: link.id, outgoing, otherId, text: map.nodes[otherId]?.text ?? 'Nodo borrado' }
    })
  }, [map, nodeId])

  if (!map || !node) return null

  const commitNote = () => {
    if (noteValue !== node.note) store.getState().setNote(nodeId, noteValue)
    setDraft(null)
  }

  const commitText = () => {
    const clean = textValue.trim()
    if (clean.length > 0 && clean !== node.text) store.getState().renameNode(nodeId, clean)
    setDraft(null)
  }

  return (
    <aside className="note-panel">
      <div className="note-head">
        <span>Nodo</span>
        <button type="button" className="ghost" onClick={onClose}>
          Cerrar
        </button>
      </div>

      <label className="field">
        <span>Título</span>
        <input
          value={textValue}
          onChange={(event) => setDraft({ id: nodeId, text: event.target.value, note: noteValue })}
          onBlur={commitText}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
          }}
        />
      </label>

      <label className="field">
        <span>Nota</span>
        <textarea
          rows={6}
          value={noteValue}
          placeholder="Escribe una nota. Usa {{así}} para crear tarjetas de hueco."
          onChange={(event) => setDraft({ id: nodeId, text: textValue, note: event.target.value })}
          onBlur={commitNote}
          onKeyDown={(event) => event.stopPropagation()}
        />
      </label>
      <p className="hint">
        Cada <code>{'{{...}}'}</code> genera una tarjeta propia. Al salir del campo se guarda.
      </p>

      <div className="field">
        <span>Color de la rama</span>
        <div className="swatches">
          <button
            type="button"
            className={node.color === null ? 'swatch active' : 'swatch'}
            onClick={() => store.getState().setColor(nodeId, null)}
            aria-label="Sin color"
          >
            ×
          </button>
          {PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              className={node.color === color ? 'swatch active' : 'swatch'}
              style={{ background: color }}
              onClick={() => store.getState().setColor(nodeId, color)}
              aria-label={`Color ${color}`}
            />
          ))}
        </div>
      </div>

      <div className="field">
        <span>Flechas</span>
        {arrows.length === 0 ? (
          <p className="hint">Sin enlaces todavía.</p>
        ) : (
          <ul className="link-list">
            {arrows.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="link-target"
                  onClick={() => {
                    const state = store.getState()
                    if (state.linkMode) state.linkClick(item.otherId)
                    else state.select(item.otherId)
                  }}
                >
                  <span aria-hidden="true">{item.outgoing ? '→' : '←'}</span>
                  <span>{item.text}</span>
                </button>
                <button
                  type="button"
                  className="link-remove"
                  onClick={() => store.getState().removeLink(item.id)}
                  aria-label={`Quitar el enlace con ${item.text}`}
                  title="Quitar enlace"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className={linkMode ? 'toggle on' : ''}
          onClick={() => store.getState().toggleLinkMode()}
        >
          {linkMode ? 'Cancelar enlace' : 'Enlazar con otro nodo'}
        </button>
      </div>

      <div className="stats">
        <div>
          <strong>{stats.total}</strong>
          <span>tarjetas en la rama</span>
        </div>
        <div>
          <strong>{stats.due}</strong>
          <span>pendientes</span>
        </div>
        <div>
          <strong>{stats.score === null ? '-' : `${Math.round(stats.score * 100)}%`}</strong>
          <span>retención</span>
        </div>
      </div>

      <div className="note-actions">
        <button type="button" onClick={() => store.getState().startReview(nodeId)}>
          Repasar esta rama
        </button>
        <button type="button" onClick={() => store.getState().addChild()}>
          Añadir hijo
        </button>
        {node.parentId ? (
          <button
            type="button"
            className="danger"
            onClick={() => {
              store.getState().removeNode(nodeId)
              onClose()
            }}
          >
            Borrar nodo
          </button>
        ) : null}
      </div>
    </aside>
  )
}
