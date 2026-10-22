import { useMemo, useState } from 'react'
import { deriveCards } from '../domain/cards'
import { toMarkdown } from '../domain/markdown'
import { isDue } from '../domain/scheduler'
import { db } from '../db/db'
import { download, parseFile, readFile, slugify } from '../lib/files'
import { useStore } from '../state/store'

function TitleField() {
  const map = useStore((state) => state.map)
  const renameMap = useStore((state) => state.renameMap)
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? map?.title ?? ''

  return (
    <input
      className="title-field"
      value={value}
      spellCheck={false}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const clean = (draft ?? map?.title ?? '').trim() || 'Mapa sin título'
        if (clean !== map?.title) renameMap(clean)
        setDraft(null)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
        event.stopPropagation()
      }}
      aria-label="Título del mapa"
    />
  )
}

export function Toolbar() {
  const map = useStore((state) => state.map)
  const list = useStore((state) => state.list)
  const reviews = useStore((state) => state.reviews)
  const heat = useStore((state) => state.heat)
  const session = useStore((state) => state.session)
  const store = useStore

  const due = useMemo(
    () => (map ? deriveCards(map).filter((card) => isDue(reviews[card.id])).length : 0),
    [map, reviews],
  )

  const exportJson = () => {
    if (!map) return
    const payload = { format: 'ariadna', version: 1, map, reviews }
    download(`${slugify(map.title)}.ariadna.json`, JSON.stringify(payload, null, 2), 'application/json')
    store.getState().notify('Mapa exportado en JSON, con el historial de repasos.')
  }

  const exportMd = () => {
    if (!map) return
    download(`${slugify(map.title)}.md`, toMarkdown(map), 'text/markdown')
    store.getState().notify('Mapa exportado en Markdown.')
  }

  const importFile = async () => {
    const picked = await readFile('.json,.md,.markdown,.txt')
    if (!picked) return
    const state = store.getState()
    const isJson = picked.name.endsWith('.json')
    if (isJson) {
      const data = parseFile(picked.text)
      if (!data) {
        state.notify('Ese JSON no tiene el formato de Ariadna.')
        return
      }
      await db.maps.put({
        id: data.map.id,
        title: data.map.title,
        updatedAt: data.map.updatedAt,
        doc: data.map,
      })
      await db.reviews.bulkPut(
        Object.entries(data.reviews ?? {}).map(([cardId, record]) => ({
          key: `${data.map.id}|${cardId}`,
          mapId: data.map.id,
          cardId,
          record,
        })),
      )
      await state.openMap(data.map.id)
      state.notify(`Importado «${data.map.title}».`)
      return
    }
    state.importMarkdown(picked.text)
  }

  return (
    <header className="toolbar">
      <div className="brand">
        <img src="/logo.svg" alt="" width={30} height={30} />
        <div>
          <strong>ariadna</strong>
          <span>el mapa es el mazo</span>
        </div>
      </div>

      <TitleField />

      <select
        className="map-select"
        value={map?.id ?? ''}
        onChange={(event) => void store.getState().openMap(event.target.value)}
        aria-label="Cambiar de mapa"
      >
        {list.map((row) => (
          <option key={row.id} value={row.id}>
            {row.title}
          </option>
        ))}
      </select>

      <div className="toolbar-actions">
        <button type="button" onClick={() => void store.getState().newMap()}>
          Nuevo
        </button>
        <button type="button" onClick={() => void importFile()}>
          Importar
        </button>
        <button type="button" onClick={exportJson}>
          JSON
        </button>
        <button type="button" onClick={exportMd}>
          Markdown
        </button>
        <button
          type="button"
          className={heat ? 'toggle on' : 'toggle'}
          onClick={() => store.getState().toggleHeat()}
          title="Colorear las ramas según tu retención"
        >
          Calor
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => store.getState().startReview()}
          disabled={Boolean(session)}
        >
          Repasar {due > 0 ? <span className="badge">{due}</span> : null}
        </button>
      </div>
    </header>
  )
}
